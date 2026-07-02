import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import parser from 'cron-parser';
import { getDb } from '../db/client';
import { asyncHandler, ApiError } from '../middleware/errors';
import { assertQueueAccess } from './queues';

const router = Router();

async function assertJobAccess(userId: string, jobId: string) {
  const db = getDb();
  const job = await db.collection('jobs').findOne({ id: jobId });
  if (!job) throw new ApiError(403, 'No access to this job');
  await assertQueueAccess(userId, job.queue_id as string);
}

/** Fetches the retry policy max_attempts for a queue. */
async function getQueueDefaults(queueId: string): Promise<{ maxAttempts: number }> {
  const db = getDb();
  const queue = await db.collection('queues').findOne({ id: queueId });
  if (!queue) return { maxAttempts: 5 };

  if (queue.retry_policy_id) {
    const policy = await db.collection('retry_policies').findOne({ id: queue.retry_policy_id });
    if (policy) return { maxAttempts: policy.max_attempts as number };
  }
  return { maxAttempts: 5 };
}

const baseJobFields = {
  queue_id: z.string().uuid(),
  type: z.string().min(1).max(100),
  payload: z.record(z.any()).default({}),
  priority: z.number().int().default(0),
  idempotency_key: z.string().max(255).optional(),
};

// ----------------------------------------------------------------------------
// POST /api/jobs — create a single job: immediate, delayed, or scheduled
// ----------------------------------------------------------------------------
const createJobSchema = z.object({
  ...baseJobFields,
  run_at: z.string().datetime().optional(),
  delay_seconds: z.number().int().min(0).optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createJobSchema.parse(req.body);
    await assertQueueAccess(req.user!.id, body.queue_id);

    const db = getDb();

    if (body.idempotency_key) {
      const existing = await db.collection('jobs').findOne({
        queue_id: body.queue_id,
        idempotency_key: body.idempotency_key,
      });
      if (existing) {
        const { _id, ...data } = existing as any;
        return res.status(200).json({ ...data, deduplicated: true });
      }
    }

    let runAt = new Date();
    if (body.run_at) runAt = new Date(body.run_at);
    else if (body.delay_seconds) runAt = new Date(Date.now() + body.delay_seconds * 1000);

    const { maxAttempts } = await getQueueDefaults(body.queue_id);
    const status = runAt.getTime() > Date.now() ? 'scheduled' : 'queued';
    const now = new Date();

    const job = {
      id: uuidv4(),
      queue_id: body.queue_id,
      scheduled_job_id: null,
      batch_id: null,
      idempotency_key: body.idempotency_key ?? null,
      type: body.type,
      payload: body.payload,
      priority: body.priority,
      status,
      run_at: runAt,
      attempt_count: 0,
      max_attempts: maxAttempts,
      claimed_by: null,
      claimed_at: null,
      started_at: null,
      completed_at: null,
      result: null,
      error: null,
      created_at: now,
      updated_at: now,
    };

    await db.collection('jobs').insertOne(job);
    const { _id, ...data } = job as any;
    res.status(201).json(data);
  })
);

// ----------------------------------------------------------------------------
// POST /api/jobs/batch — create many jobs sharing one batch_id in one request
// ----------------------------------------------------------------------------
const batchJobSchema = z.object({
  queue_id: z.string().uuid(),
  jobs: z
    .array(
      z.object({
        type: z.string().min(1).max(100),
        payload: z.record(z.any()).default({}),
        priority: z.number().int().default(0),
      })
    )
    .min(1)
    .max(1000),
});

router.post(
  '/batch',
  asyncHandler(async (req, res) => {
    const body = batchJobSchema.parse(req.body);
    await assertQueueAccess(req.user!.id, body.queue_id);

    const { maxAttempts } = await getQueueDefaults(body.queue_id);
    const batchId = uuidv4();
    const now = new Date();

    const db = getDb();
    const jobs = body.jobs.map((j) => ({
      id: uuidv4(),
      queue_id: body.queue_id,
      scheduled_job_id: null,
      batch_id: batchId,
      idempotency_key: null,
      type: j.type,
      payload: j.payload,
      priority: j.priority,
      status: 'queued',
      run_at: now,
      attempt_count: 0,
      max_attempts: maxAttempts,
      claimed_by: null,
      claimed_at: null,
      started_at: null,
      completed_at: null,
      result: null,
      error: null,
      created_at: now,
      updated_at: now,
    }));

    await db.collection('jobs').insertMany(jobs);
    const inserted = jobs.map(({ _id, ...j }: any) => j);
    res.status(201).json({ batch_id: batchId, count: inserted.length, jobs: inserted });
  })
);

// ----------------------------------------------------------------------------
// POST /api/jobs/recurring — create a cron-based scheduled_jobs template
// ----------------------------------------------------------------------------
const recurringSchema = z.object({
  queue_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  cron_expression: z.string().min(1),
  job_type: z.string().min(1).max(100),
  payload: z.record(z.any()).default({}),
});

router.post(
  '/recurring',
  asyncHandler(async (req, res) => {
    const body = recurringSchema.parse(req.body);
    await assertQueueAccess(req.user!.id, body.queue_id);

    let nextRun: Date;
    try {
      nextRun = parser.parseExpression(body.cron_expression, { utc: true }).next().toDate();
    } catch {
      throw new ApiError(400, `Invalid cron expression: ${body.cron_expression}`);
    }

    const db = getDb();
    const scheduledJob = {
      id: uuidv4(),
      queue_id: body.queue_id,
      name: body.name,
      cron_expression: body.cron_expression,
      job_type: body.job_type,
      payload: body.payload,
      is_active: true,
      last_run_at: null,
      next_run_at: nextRun,
      created_at: new Date(),
    };

    await db.collection('scheduled_jobs').insertOne(scheduledJob);
    const { _id, ...data } = scheduledJob as any;
    res.status(201).json(data);
  })
);

// GET /api/jobs/recurring?queue_id=...
router.get(
  '/recurring',
  asyncHandler(async (req, res) => {
    const queueId = req.query.queue_id as string;
    if (!queueId) throw new ApiError(400, 'queue_id query param is required');
    await assertQueueAccess(req.user!.id, queueId);

    const db = getDb();
    const results = await db
      .collection('scheduled_jobs')
      .find({ queue_id: queueId })
      .sort({ created_at: -1 })
      .toArray();

    res.json({ data: results.map(({ _id, ...r }) => r) });
  })
);

// PATCH /api/jobs/recurring/:id — pause/resume a recurring template
router.patch(
  '/recurring/:id',
  asyncHandler(async (req, res) => {
    const schema = z.object({ is_active: z.boolean() });
    const body = schema.parse(req.body);

    const db = getDb();
    const existing = await db.collection('scheduled_jobs').findOne({ id: req.params.id });
    if (!existing) throw new ApiError(404, 'Scheduled job not found');
    await assertQueueAccess(req.user!.id, existing.queue_id as string);

    const result = await db
      .collection('scheduled_jobs')
      .findOneAndUpdate(
        { id: req.params.id },
        { $set: { is_active: body.is_active } },
        { returnDocument: 'after' }
      );

    if (!result) throw new ApiError(404, 'Scheduled job not found');
    const { _id, ...data } = result as any;
    res.json(data);
  })
);

// ----------------------------------------------------------------------------
// GET /api/jobs — list with filtering + pagination
// ----------------------------------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const queueId = req.query.queue_id as string | undefined;
    if (!queueId) throw new ApiError(400, 'queue_id query param is required');
    await assertQueueAccess(req.user!.id, queueId);

    const status = req.query.status as string | undefined;
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const db = getDb();
    const filter: Record<string, any> = { queue_id: queueId };
    if (status) filter.status = status;

    const [total, docs] = await Promise.all([
      db.collection('jobs').countDocuments(filter),
      db.collection('jobs').find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
    ]);

    res.json({
      data: docs.map(({ _id, ...d }) => d),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  })
);

// GET /api/jobs/:id — full detail: job + executions + logs
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertJobAccess(req.user!.id, req.params.id);

    const db = getDb();
    const job = await db.collection('jobs').findOne({ id: req.params.id });
    if (!job) throw new ApiError(404, 'Job not found');

    const [executions, logs] = await Promise.all([
      db.collection('job_executions').find({ job_id: req.params.id }).sort({ attempt_number: 1 }).toArray(),
      db.collection('job_logs').find({ job_id: req.params.id }).sort({ created_at: 1 }).toArray(),
    ]);

    const { _id, ...jobData } = job as any;
    res.json({
      ...jobData,
      executions: executions.map(({ _id: _e, ...e }) => e),
      logs: logs.map(({ _id: _l, ...l }) => l),
    });
  })
);

// POST /api/jobs/:id/retry — manually requeue a failed / dead-lettered job
router.post(
  '/:id/retry',
  asyncHandler(async (req, res) => {
    await assertJobAccess(req.user!.id, req.params.id);

    const db = getDb();
    const job = await db.collection('jobs').findOne({ id: req.params.id });
    if (!job) throw new ApiError(404, 'Job not found');
    if (!['failed', 'dead_letter', 'cancelled'].includes(job.status as string)) {
      throw new ApiError(400, `Cannot retry a job in status '${job.status}'`);
    }

    const result = await db.collection('jobs').findOneAndUpdate(
      { id: req.params.id },
      {
        $set: {
          status: 'queued',
          run_at: new Date(),
          claimed_by: null,
          claimed_at: null,
          error: null,
          attempt_count: 0,
          updated_at: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) throw new ApiError(404, 'Job not found');

    // Remove the DLQ entry so the dead letter page stays clean after retry
    await db.collection('dead_letter_entries').deleteOne({ original_job_id: req.params.id });

    const { _id, ...data } = result as any;
    res.json(data);
  })
);

// POST /api/jobs/:id/cancel — cancel a job that hasn't started running yet
router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    await assertJobAccess(req.user!.id, req.params.id);

    const db = getDb();
    const result = await db.collection('jobs').findOneAndUpdate(
      { id: req.params.id, status: { $in: ['queued', 'scheduled', 'retrying'] } },
      { $set: { status: 'cancelled', updated_at: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError(400, 'Job cannot be cancelled in its current status');
    }
    const { _id, ...data } = result as any;
    res.json(data);
  })
);

export default router;
