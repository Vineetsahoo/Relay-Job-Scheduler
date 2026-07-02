import dotenv from 'dotenv';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import parser from 'cron-parser';
import { connectDb, getDb, closeDb } from './db/client';
import { getHandler } from './jobs/handlers';
import { computeRetryDelaySeconds, hasExhaustedRetries, RetryPolicyConfig } from './jobs/retryPolicy';

dotenv.config();

const WORKER_NAME = process.env.WORKER_NAME || `worker-${os.hostname()}-${process.pid}`;
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '2000', 10);
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '5000', 10);
const SCHEDULER_INTERVAL_MS = 15000;
const DEFAULT_JOB_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_POLICY: RetryPolicyConfig = {
  strategy: 'fixed',
  baseDelaySeconds: 30,
  maxDelaySeconds: 3600,
  maxAttempts: 5,
};

let workerId: string;
let activeJobs = 0;
let shuttingDown = false;
let pollTimer: NodeJS.Timeout;
let heartbeatTimer: NodeJS.Timeout;
let schedulerTimer: NodeJS.Timeout;

async function registerWorker() {
  const db = getDb();
  workerId = uuidv4();
  const worker = {
    id: workerId,
    name: WORKER_NAME,
    hostname: os.hostname(),
    status: 'online',
    concurrency: CONCURRENCY,
    active_job_count: 0,
    started_at: new Date(),
    last_heartbeat_at: new Date(),
  };
  await db.collection('workers').insertOne(worker);
  console.log(`[worker] registered as ${WORKER_NAME} (id=${workerId}, concurrency=${CONCURRENCY})`);
}

async function sendHeartbeat() {
  try {
    const db = getDb();
    const now = new Date();
    await db.collection('workers').updateOne(
      { id: workerId },
      {
        $set: {
          last_heartbeat_at: now,
          active_job_count: activeJobs,
          status: shuttingDown ? 'draining' : 'online',
        },
      }
    );
    await db.collection('worker_heartbeats').insertOne({
      id: uuidv4(),
      worker_id: workerId,
      active_jobs: activeJobs,
      created_at: now,
    });
  } catch (err) {
    console.error('[worker] heartbeat failed', err);
  }
}

/**
 * Atomically claims a single runnable job from a given queue using
 * findOneAndUpdate. MongoDB's document-level locking ensures two workers
 * racing on the same queue will never claim the same job.
 */
async function claimOneJobFromQueue(queueId: string): Promise<any | null> {
  const db = getDb();
  const now = new Date();

  const result = await db.collection('jobs').findOneAndUpdate(
    {
      queue_id: queueId,
      status: { $in: ['queued', 'retrying'] },
      run_at: { $lte: now },
    },
    {
      $set: {
        status: 'claimed',
        claimed_by: workerId,
        claimed_at: now,
        updated_at: now,
      },
    },
    {
      sort: { priority: -1, run_at: 1 },
      returnDocument: 'after',
    }
  );

  return result ?? null;
}

/** One poll cycle: for each active queue (priority order), claim jobs up to
 * both the queue's concurrency_limit and this worker's remaining capacity. */
async function pollAndClaim() {
  if (shuttingDown) return;
  const capacity = CONCURRENCY - activeJobs;
  if (capacity <= 0) return;

  const db = getDb();
  const queues = await db
    .collection('queues')
    .find({ is_paused: false })
    .sort({ priority: -1 })
    .toArray();

  let remaining = capacity;
  for (const queue of queues) {
    if (remaining <= 0) break;

    const runningCount = await db.collection('jobs').countDocuments({
      queue_id: queue.id,
      status: { $in: ['claimed', 'running'] },
    });

    const room = (queue.concurrency_limit as number) - runningCount;
    if (room <= 0) continue;

    const toClaim = Math.min(room, remaining);
    for (let i = 0; i < toClaim; i++) {
      const job = await claimOneJobFromQueue(queue.id as string);
      if (!job) break; // no more claimable jobs in this queue
      remaining--;
      activeJobs++;
      executeJob(job).finally(() => {
        activeJobs--;
      });
    }
  }
}

async function getRetryPolicyForQueue(queueId: string): Promise<RetryPolicyConfig> {
  const db = getDb();
  const queue = await db.collection('queues').findOne({ id: queueId });
  if (!queue || !queue.retry_policy_id) return DEFAULT_RETRY_POLICY;

  const policy = await db.collection('retry_policies').findOne({ id: queue.retry_policy_id });
  if (!policy) return DEFAULT_RETRY_POLICY;

  return {
    strategy: policy.strategy as any,
    baseDelaySeconds: policy.base_delay_seconds as number,
    maxDelaySeconds: policy.max_delay_seconds as number,
    maxAttempts: policy.max_attempts as number,
  };
}

async function log(
  jobId: string,
  executionId: string | null,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info'
) {
  const db = getDb();
  await db.collection('job_logs').insertOne({
    id: uuidv4(),
    job_id: jobId,
    execution_id: executionId,
    level,
    message,
    created_at: new Date(),
  });
}

async function executeJob(job: any) {
  const db = getDb();
  const attemptNumber = job.attempt_count + 1;
  const now = new Date();

  await db.collection('jobs').updateOne(
    { id: job.id },
    { $set: { status: 'running', started_at: now, updated_at: now } }
  );

  const executionId = uuidv4();
  await db.collection('job_executions').insertOne({
    id: executionId,
    job_id: job.id,
    worker_id: workerId,
    attempt_number: attemptNumber,
    status: 'running',
    started_at: now,
    finished_at: null,
    duration_ms: null,
    error: null,
    result: null,
  });

  const startedAt = Date.now();
  const handler = getHandler(job.type);

  try {
    if (!handler) throw new Error(`No handler registered for job type '${job.type}'`);

    await log(job.id, executionId, `Attempt ${attemptNumber} started by ${WORKER_NAME}`);

    const result = await Promise.race([
      handler({
        jobId: job.id,
        payload: job.payload,
        log: (message, level) => log(job.id, executionId, message, level),
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Job timed out')), DEFAULT_JOB_TIMEOUT_MS)
      ),
    ]);

    const durationMs = Date.now() - startedAt;
    const finishedAt = new Date();

    await db.collection('job_executions').updateOne(
      { id: executionId },
      { $set: { status: 'completed', finished_at: finishedAt, duration_ms: durationMs, result: result ?? null } }
    );
    await db.collection('jobs').updateOne(
      { id: job.id },
      {
        $set: {
          status: 'completed',
          completed_at: finishedAt,
          attempt_count: attemptNumber,
          result: result ?? null,
          updated_at: finishedAt,
        },
      }
    );
    await log(job.id, executionId, `Attempt ${attemptNumber} completed in ${durationMs}ms`);
  } catch (err: any) {
    const durationMs = Date.now() - startedAt;
    const errorMessage = err?.message || String(err);
    const finishedAt = new Date();

    await db.collection('job_executions').updateOne(
      { id: executionId },
      { $set: { status: 'failed', finished_at: finishedAt, duration_ms: durationMs, error: errorMessage } }
    );
    await log(job.id, executionId, `Attempt ${attemptNumber} failed: ${errorMessage}`, 'error');

    const policy = await getRetryPolicyForQueue(job.queue_id);

    if (hasExhaustedRetries(policy, attemptNumber)) {
      await db.collection('jobs').updateOne(
        { id: job.id },
        {
          $set: {
            status: 'dead_letter',
            attempt_count: attemptNumber,
            error: errorMessage,
            completed_at: finishedAt,
            updated_at: finishedAt,
          },
        }
      );
      await db.collection('dead_letter_entries').insertOne({
        id: uuidv4(),
        original_job_id: job.id,
        queue_id: job.queue_id,
        type: job.type,
        payload: job.payload,
        attempt_count: attemptNumber,
        last_error: errorMessage,
        moved_at: finishedAt,
      });
      await log(job.id, executionId, `Moved to dead letter queue after ${attemptNumber} attempts`, 'error');
    } else {
      const delaySeconds = computeRetryDelaySeconds(policy, attemptNumber);
      const retryAt = new Date(Date.now() + delaySeconds * 1000);
      await db.collection('jobs').updateOne(
        { id: job.id },
        {
          $set: {
            status: 'retrying',
            attempt_count: attemptNumber,
            error: errorMessage,
            run_at: retryAt,
            claimed_by: null,
            claimed_at: null,
            updated_at: new Date(),
          },
        }
      );
      await log(
        job.id,
        executionId,
        `Will retry in ${delaySeconds}s (attempt ${attemptNumber + 1}/${policy.maxAttempts})`
      );
    }
  }
}

/** Materializes due cron templates into real, runnable job rows. */
async function runScheduler() {
  if (shuttingDown) return;
  try {
    const db = getDb();
    const now = new Date();

    const dueTemplates = await db
      .collection('scheduled_jobs')
      .find({ is_active: true, next_run_at: { $lte: now } })
      .toArray();

    for (const template of dueTemplates) {
      try {
        const jobId = uuidv4();
        const jobNow = new Date();

        await db.collection('jobs').insertOne({
          id: jobId,
          queue_id: template.queue_id,
          scheduled_job_id: template.id,
          batch_id: null,
          idempotency_key: null,
          type: template.job_type,
          payload: template.payload,
          priority: 0,
          status: 'queued',
          run_at: jobNow,
          attempt_count: 0,
          max_attempts: 5,
          claimed_by: null,
          claimed_at: null,
          started_at: null,
          completed_at: null,
          result: null,
          error: null,
          created_at: jobNow,
          updated_at: jobNow,
        });

        const next = parser.parseExpression(template.cron_expression as string, { utc: true }).next().toDate();

        await db.collection('scheduled_jobs').updateOne(
          { id: template.id },
          { $set: { last_run_at: jobNow, next_run_at: next } }
        );

        console.log(
          `[scheduler] materialized job from template '${template.name}', next run at ${next.toISOString()}`
        );
      } catch (err) {
        console.error('[scheduler] failed to materialize job', err);
      }
    }
  } catch (err) {
    console.error('[scheduler] error checking due templates', err);
  }
}

async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] received ${signal}, draining (${activeJobs} active job(s))...`);

  clearInterval(pollTimer);
  clearInterval(schedulerTimer);

  const db = getDb();
  await db.collection('workers').updateOne({ id: workerId }, { $set: { status: 'draining' } });

  const deadline = Date.now() + 30_000;
  while (activeJobs > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
  }

  clearInterval(heartbeatTimer);
  await db.collection('workers').updateOne(
    { id: workerId },
    { $set: { status: 'offline', active_job_count: 0 } }
  );
  console.log('[worker] shutdown complete');
  await closeDb();
  process.exit(0);
}

async function main() {
  await connectDb();
  await registerWorker();
  pollTimer = setInterval(() => pollAndClaim().catch((e) => console.error('[worker] poll error', e)), POLL_INTERVAL_MS);
  heartbeatTimer = setInterval(
    () => sendHeartbeat().catch((e) => console.error('[worker] heartbeat error', e)),
    HEARTBEAT_INTERVAL_MS
  );
  schedulerTimer = setInterval(
    () => runScheduler().catch((e) => console.error('[worker] scheduler error', e)),
    SCHEDULER_INTERVAL_MS
  );

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[worker] fatal startup error', err);
  process.exit(1);
});
