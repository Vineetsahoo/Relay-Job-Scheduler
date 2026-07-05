/**
 * Seed script — rich demo data for both projects.
 *
 *   npx ts-node src/seed.ts          (first run)
 *   npx ts-node src/seed.ts --force  (wipe + reseed)
 *
 * Run via:  npm run seed
 */

import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { connectDb, getDb } from './db/client';

// ── CLI flag ──────────────────────────────────────────────────────────────────
const FORCE = process.argv.includes('--force');

// ── time helpers ──────────────────────────────────────────────────────────────
const daysAgo   = (n: number) => new Date(Date.now() - n * 86_400_000);
const hoursAgo  = (n: number) => new Date(Date.now() - n * 3_600_000);
const minsAgo   = (n: number) => new Date(Date.now() - n * 60_000);
const inMins    = (n: number) => new Date(Date.now() + n * 60_000);
const rand      = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const pick      = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// ── demo credentials ──────────────────────────────────────────────────────────
export const DEMO_EMAIL    = 'admin@demo.com';
export const DEMO_PASSWORD = 'demo1234';

// ── error messages pool ───────────────────────────────────────────────────────
const ERRORS = [
  'Connection timeout after 30000ms',
  'ECONNREFUSED 127.0.0.1:5432 — database unreachable',
  'HTTP 429 Too Many Requests — upstream rate limit exceeded',
  'TypeError: Cannot read properties of undefined (reading "id")',
  'MongoServerError: E11000 duplicate key error collection: jobs',
  'Stripe API error: card_declined (insufficient_funds)',
  'S3 PutObject failed: AccessDenied — check IAM policy',
  'PDF generation timed out after 60s — document too large',
  'SMTP error 550 5.1.1: The email account does not exist',
  'Redis WRONGTYPE Operation: expected String got List',
  'MaxAttemptsError: DynamoDB ProvisionedThroughputExceededException',
  'Error: JWT signature verification failed — token may be forged',
  'gRPC UNAVAILABLE: upstream connect error or disconnect/reset before headers',
  'RangeError: Maximum call stack size exceeded in recursive handler',
  'ValidationError: payload.amount must be a positive number, got -42',
];

// ── payload factory ───────────────────────────────────────────────────────────
function payload(type: string): Record<string, any> {
  const map: Record<string, () => Record<string, any>> = {
    // email
    send_welcome_email:  () => ({ user_id: uuidv4(), to: `user${rand(1,9999)}@example.com`, template: 'welcome_v3', locale: pick(['en','fr','de','es']) }),
    send_invoice:        () => ({ invoice_id: uuidv4(), amount: +(Math.random()*1200+5).toFixed(2), currency: pick(['USD','EUR','GBP']), due_days: pick([7,14,30]) }),
    send_password_reset: () => ({ user_id: uuidv4(), token: uuidv4(), expires_in: 3600 }),
    send_digest:         () => ({ user_id: uuidv4(), period: pick(['daily','weekly']), item_count: rand(1,80), include_analytics: true }),
    send_campaign:       () => ({ campaign_id: uuidv4(), segment: pick(['new_users','power_users','churned']), subject: 'Your weekly summary is ready' }),
    // image
    resize_thumbnail:    () => ({ file_key: `uploads/${uuidv4()}.jpg`, width: pick([100,200,400,800]), height: pick([100,200,400,800]) }),
    generate_preview:    () => ({ file_key: `uploads/${uuidv4()}.png`, format: pick(['webp','avif','jpeg']) }),
    compress_image:      () => ({ file_key: `uploads/${uuidv4()}.jpg`, quality: rand(60,90), strip_metadata: true }),
    watermark_image:     () => ({ file_key: `uploads/${uuidv4()}.jpg`, text: pick(['© Acme 2025','CONFIDENTIAL','DRAFT']), opacity: 0.4 }),
    generate_og_image:   () => ({ slug: `/blog/${uuidv4().slice(0,8)}`, title: 'How we scaled to 1M jobs/day', template: 'blog' }),
    // payments
    charge_card:         () => ({ order_id: uuidv4(), amount: +(Math.random()*2000+1).toFixed(2), currency: 'USD', customer_id: uuidv4() }),
    issue_refund:        () => ({ order_id: uuidv4(), amount: +(Math.random()*500+1).toFixed(2), reason: pick(['duplicate','fraudulent','requested_by_customer']) }),
    payout_vendor:       () => ({ vendor_id: uuidv4(), amount: +(Math.random()*8000+100).toFixed(2), method: pick(['bank_transfer','paypal','stripe_express']) }),
    reconcile_account:   () => ({ account_id: uuidv4(), from: daysAgo(7).toISOString(), to: new Date().toISOString() }),
    verify_payment:      () => ({ payment_intent_id: `pi_${uuidv4().replace(/-/g,'')}`, expected_amount: +(Math.random()*500).toFixed(2) }),
    // data export
    export_csv:          () => ({ resource: pick(['orders','users','products','events']), filters: { status: 'completed', limit: rand(1000,50000) }, format: 'csv' }),
    export_pdf:          () => ({ report_type: pick(['monthly_summary','annual_report','invoice_bundle']), period: '2025-06' }),
    sync_analytics:      () => ({ source: 'postgres', destination: pick(['bigquery','redshift','snowflake']), table: pick(['events','sessions','conversions']) }),
    archive_records:     () => ({ collection: pick(['audit_logs','old_jobs','sessions']), older_than_days: rand(30,180) }),
    build_snapshot:      () => ({ entity: pick(['products','users','inventory']), as_of: daysAgo(1).toISOString() }),
    // analytics
    track_pageview:      () => ({ user_id: uuidv4(), path: pick(['/dashboard','/pricing','/blog','/signup']), referrer: pick(['https://google.com','https://twitter.com','direct']), session_id: uuidv4() }),
    track_purchase:      () => ({ user_id: uuidv4(), product_id: uuidv4(), revenue: +(Math.random()*400).toFixed(2), currency: 'USD' }),
    flush_segment:       () => ({ segment_id: uuidv4(), event_count: rand(10,2000), destination: pick(['mixpanel','amplitude','segment']) }),
    build_report:        () => ({ report_id: uuidv4(), type: pick(['funnel','cohort','retention','revenue']), date: new Date().toISOString().slice(0,10) }),
    update_user_traits:  () => ({ user_id: uuidv4(), traits: { plan: pick(['free','pro','enterprise']), mrr: +(Math.random()*500).toFixed(2) } }),
    // infra
    send_webhook:        () => ({ event: pick(['job.completed','payment.succeeded','user.created']), endpoint: `https://hooks.customer${rand(1,99)}.io/relay`, retry: rand(0,3) }),
    purge_stale_jobs:    () => ({ older_than_days: rand(30,90), statuses: ['completed','cancelled'], dry_run: false }),
    reindex_search:      () => ({ index: pick(['products','articles','users']), full: rand(0,1)===1 }),
    fail_randomly:       () => ({ fail_rate: pick([0.3,0.5,0.8,1.0]), message: 'Intentional test failure' }),
  };
  return (map[type] ?? (() => ({ task_id: uuidv4() })))();
}

// ── project definitions ───────────────────────────────────────────────────────
interface ProjectDef {
  name: string;
  queues: QueueDef[];
  workerCount: number;
  jobsPerQueue: number;
}

interface QueueDef {
  name: string;
  priority: number;
  concurrency: number;
  strategy: 'fixed' | 'linear' | 'exponential';
  baseDelay: number;
  maxDelay: number;
  maxAttempts: number;
  paused?: boolean;
  jobTypes: string[];
}

const PROJECTS: ProjectDef[] = [
  {
    name: 'Production App',
    workerCount: 8,
    jobsPerQueue: 80,
    queues: [
      { name: 'email-notifications', priority: 10, concurrency: 25, strategy: 'exponential', baseDelay: 5,  maxDelay: 300,  maxAttempts: 5, jobTypes: ['send_welcome_email','send_invoice','send_password_reset','send_digest','send_campaign'] },
      { name: 'image-processing',    priority: 6,  concurrency: 6,  strategy: 'linear',      baseDelay: 30, maxDelay: 600,  maxAttempts: 3, jobTypes: ['resize_thumbnail','generate_preview','compress_image','watermark_image','generate_og_image'] },
      { name: 'payment-processing',  priority: 20, concurrency: 3,  strategy: 'exponential', baseDelay: 10, maxDelay: 900,  maxAttempts: 7, jobTypes: ['charge_card','issue_refund','payout_vendor','reconcile_account','verify_payment'] },
      { name: 'data-export',         priority: 3,  concurrency: 2,  strategy: 'fixed',       baseDelay: 60, maxDelay: 600,  maxAttempts: 2, paused: true, jobTypes: ['export_csv','export_pdf','sync_analytics','archive_records','build_snapshot'] },
      { name: 'analytics-events',    priority: 1,  concurrency: 15, strategy: 'linear',      baseDelay: 5,  maxDelay: 120,  maxAttempts: 3, jobTypes: ['track_pageview','track_purchase','flush_segment','build_report','update_user_traits'] },
      { name: 'webhooks',            priority: 8,  concurrency: 10, strategy: 'exponential', baseDelay: 5,  maxDelay: 180,  maxAttempts: 5, jobTypes: ['send_webhook','fail_randomly'] },
      { name: 'infrastructure',      priority: 2,  concurrency: 1,  strategy: 'fixed',       baseDelay: 120,maxDelay: 3600, maxAttempts: 2, jobTypes: ['purge_stale_jobs','reindex_search','archive_records'] },
    ],
  },
  {
    name: 'Staging',
    workerCount: 3,
    jobsPerQueue: 30,
    queues: [
      { name: 'email-staging',       priority: 5,  concurrency: 5,  strategy: 'fixed',       baseDelay: 10, maxDelay: 120,  maxAttempts: 3, jobTypes: ['send_welcome_email','send_invoice','send_campaign'] },
      { name: 'media-pipeline',      priority: 4,  concurrency: 4,  strategy: 'linear',      baseDelay: 20, maxDelay: 300,  maxAttempts: 3, jobTypes: ['resize_thumbnail','compress_image','generate_og_image'] },
      { name: 'payments-staging',    priority: 8,  concurrency: 2,  strategy: 'exponential', baseDelay: 15, maxDelay: 600,  maxAttempts: 5, jobTypes: ['charge_card','verify_payment','issue_refund'] },
      { name: 'test-chaos',          priority: 1,  concurrency: 3,  strategy: 'fixed',       baseDelay: 5,  maxDelay: 60,   maxAttempts: 2, jobTypes: ['fail_randomly','send_webhook'] },
    ],
  },
];

// ── worker definitions ────────────────────────────────────────────────────────
const WORKER_TEMPLATES = [
  { suffix: '01', status: 'online',   concurrency: 20, activeFrac: 0.75 },
  { suffix: '02', status: 'online',   concurrency: 20, activeFrac: 0.40 },
  { suffix: '03', status: 'online',   concurrency: 15, activeFrac: 0.90 },
  { suffix: '04', status: 'online',   concurrency: 10, activeFrac: 0.60 },
  { suffix: '05', status: 'online',   concurrency: 20, activeFrac: 0.20 },
  { suffix: '06', status: 'draining', concurrency: 10, activeFrac: 0.10 },
  { suffix: '07', status: 'offline',  concurrency: 20, activeFrac: 0 },
  { suffix: '08', status: 'online',   concurrency: 15, activeFrac: 0.55 },
];

// ── main ──────────────────────────────────────────────────────────────────────
async function seed() {
  await connectDb();
  const db = getDb();

  // Optionally wipe collections for a fresh seed
  if (FORCE) {
    console.log('⚠  --force: wiping existing demo data…');
    for (const col of ['users','organizations','organization_members','projects','queues','retry_policies','workers','worker_heartbeats','jobs','job_executions','scheduled_jobs','dead_letter_entries']) {
      await db.collection(col).deleteMany({});
    }
  }

  // ── 1. User ──────────────────────────────────────────────────────────────────
  let userId: string;
  const existingUser = await db.collection('users').findOne({ email: DEMO_EMAIL });
  if (existingUser) {
    console.log('✓ Demo user already exists — skipping user + org');
    userId = existingUser.id as string;
  } else {
    userId = uuidv4();
    await db.collection('users').insertOne({
      id: userId,
      name: 'Admin Demo',
      email: DEMO_EMAIL,
      password_hash: await bcrypt.hash(DEMO_PASSWORD, 10),
      created_at: daysAgo(60),
    });
    console.log(`✓ Created user ${DEMO_EMAIL}`);
  }

  // ── 2. Org ───────────────────────────────────────────────────────────────────
  let orgId: string;
  const existingOrg = await db.collection('organizations').findOne({ created_by: userId });
  if (existingOrg) {
    orgId = existingOrg.id as string;
  } else {
    orgId = uuidv4();
    await db.collection('organizations').insertOne({ id: orgId, name: 'Acme Corp', created_by: userId, created_at: daysAgo(60) });
    await db.collection('organization_members').insertOne({ organization_id: orgId, user_id: userId, role: 'owner', joined_at: daysAgo(60) });
    console.log('✓ Created org Acme Corp');
  }

  // ── 3. Projects + Queues + Workers + Jobs (per project) ──────────────────────
  for (const projDef of PROJECTS) {
    // Check if project already exists
    const existing = await db.collection('projects').findOne({ organization_id: orgId, name: projDef.name });
    if (existing) {
      const jobCount = await db.collection('jobs').countDocuments({ queue_id: { $exists: true } });
      if (jobCount > 200 && !FORCE) {
        console.log(`✓ Project "${projDef.name}" already seeded — skipping (use --force to reseed)`);
        continue;
      }
    }

    const projectId = existing?.id ?? uuidv4();
    const apiKey = 'demo_' + uuidv4().replace(/-/g,'').slice(0,32);

    if (!existing) {
      await db.collection('projects').insertOne({
        id: projectId,
        organization_id: orgId,
        name: projDef.name,
        api_key: apiKey,
        created_at: daysAgo(45),
      });
    }
    console.log(`\n▶ Seeding project: ${projDef.name}`);

    // ── Workers ──────────────────────────────────────────────────────────────
    const workerIds: string[] = [];
    const existingWorkers = await db.collection('workers').countDocuments();

    if (existingWorkers === 0 || FORCE) {
      const templates = WORKER_TEMPLATES.slice(0, projDef.workerCount);
      for (const t of templates) {
        const wId = uuidv4();
        workerIds.push(wId);
        const active = Math.round(t.concurrency * t.activeFrac);
        const lastHb = t.status === 'offline' ? hoursAgo(rand(3,12)) : minsAgo(rand(0,2));
        await db.collection('workers').insertOne({
          id: wId,
          name: `${projDef.name.toLowerCase().replace(/\s+/g,'-')}-worker-${t.suffix}`,
          hostname: `worker-${t.suffix}.${projDef.name.toLowerCase().replace(/\s+/g,'')}.internal`,
          status: t.status,
          concurrency: t.concurrency,
          active_job_count: active,
          started_at: hoursAgo(rand(12,72)),
          last_heartbeat_at: lastHb,
        });

        // Heartbeat history for sparklines (50 data points over past hour)
        if (t.status !== 'offline') {
          const hbDocs = Array.from({ length: 50 }, (_, i) => ({
            id: uuidv4(),
            worker_id: wId,
            active_jobs: Math.max(0, Math.min(t.concurrency, Math.round(active + rand(-3,3)))),
            created_at: new Date(Date.now() - (50 - i) * 72_000), // every ~72s
          }));
          await db.collection('worker_heartbeats').insertMany(hbDocs);
        }
      }
      console.log(`  ✓ ${projDef.workerCount} workers + heartbeats`);
    } else {
      // Re-use existing worker IDs
      const ws = await db.collection('workers').find().limit(projDef.workerCount).toArray();
      workerIds.push(...ws.map(w => w.id as string));
    }

    // ── Queues ────────────────────────────────────────────────────────────────
    const queueIdMap: Record<string, string> = {};

    for (const qDef of projDef.queues) {
      const existingQ = await db.collection('queues').findOne({ project_id: projectId, name: qDef.name });
      const qId = existingQ?.id ?? uuidv4();
      queueIdMap[qDef.name] = qId;

      if (!existingQ) {
        // Create retry policy
        const rpId = uuidv4();
        await db.collection('retry_policies').insertOne({
          id: rpId, name: `${qDef.name}-policy`,
          strategy: qDef.strategy,
          base_delay_seconds: qDef.baseDelay,
          max_delay_seconds: qDef.maxDelay,
          max_attempts: qDef.maxAttempts,
          created_at: daysAgo(40),
        });

        await db.collection('queues').insertOne({
          id: qId,
          project_id: projectId,
          name: qDef.name,
          priority: qDef.priority,
          concurrency_limit: qDef.concurrency,
          is_paused: !!qDef.paused,
          retry_policy_id: rpId,
          strategy: qDef.strategy,
          base_delay_seconds: qDef.baseDelay,
          max_delay_seconds: qDef.maxDelay,
          max_attempts: qDef.maxAttempts,
          created_at: daysAgo(40),
        });
      }
    }
    console.log(`  ✓ ${projDef.queues.length} queues`);

    // ── Scheduled jobs ────────────────────────────────────────────────────────
    const scheduledDefs = [
      { name: 'Nightly digest',    queue: projDef.queues[0].name, cron: '0 8 * * *',  type: 'send_digest',     active: true  },
      { name: 'Hourly analytics',  queue: projDef.queues[4 < projDef.queues.length ? 4 : 0].name, cron: '0 * * * *', type: 'build_report', active: true },
      { name: 'Weekly CSV export', queue: projDef.queues[3 < projDef.queues.length ? 3 : 0].name, cron: '0 3 * * 0', type: 'export_csv',   active: false },
      { name: 'Vendor payout',     queue: projDef.queues[2 < projDef.queues.length ? 2 : 0].name, cron: '0 10 * * 1', type: 'payout_vendor', active: true },
      { name: 'Search reindex',    queue: projDef.queues[projDef.queues.length - 1].name, cron: '30 2 * * *', type: 'reindex_search', active: true },
    ].slice(0, projDef.queues.length);

    for (const s of scheduledDefs) {
      const existsS = await db.collection('scheduled_jobs').findOne({ queue_id: queueIdMap[s.queue], name: s.name });
      if (!existsS) {
        await db.collection('scheduled_jobs').insertOne({
          id: uuidv4(),
          queue_id: queueIdMap[s.queue],
          name: s.name,
          cron_expression: s.cron,
          job_type: s.type,
          payload: payload(s.type),
          is_active: s.active,
          last_run_at: s.active ? hoursAgo(rand(1,10)) : null,
          next_run_at: inMins(rand(30,600)),
          created_at: daysAgo(35),
        });
      }
    }
    console.log(`  ✓ ${scheduledDefs.length} scheduled jobs`);

    // ── Jobs ──────────────────────────────────────────────────────────────────
    let totalJobs = 0;
    const dlCandidates: Array<{ jobId: string; queueId: string; type: string; p: any; attempts: number; error: string }> = [];

    for (const qDef of projDef.queues) {
      const qId = queueIdMap[qDef.name];
      const jobDocs: any[] = [];
      const executionDocs: any[] = [];

      for (let i = 0; i < projDef.jobsPerQueue; i++) {
        const jobId = uuidv4();
        const type = pick(qDef.jobTypes);
        const p = payload(type);

        // Status distribution: ~55% completed, rest spread
        const r = Math.random();
        let status: string;
        if      (r < 0.55) status = 'completed';
        else if (r < 0.64) status = 'queued';
        else if (r < 0.72) status = 'running';
        else if (r < 0.79) status = 'failed';
        else if (r < 0.84) status = 'retrying';
        else if (r < 0.89) status = 'dead_letter';
        else if (r < 0.95) status = 'scheduled';
        else               status = 'completed';

        const createdAt   = daysAgo(rand(0,21));
        const startedAt   = ['running','completed','failed','retrying'].includes(status)
          ? new Date(createdAt.getTime() + rand(100,5000)) : null;
        const durationMs  = rand(80, 45_000);
        const completedAt = status === 'completed'
          ? new Date((startedAt ?? createdAt).getTime() + durationMs) : null;
        const runAt       = status === 'scheduled'
          ? inMins(rand(5,240)) : createdAt;

        const attemptCount = status === 'dead_letter' ? qDef.maxAttempts
          : status === 'retrying' ? rand(1, qDef.maxAttempts - 1)
          : status === 'failed'   ? rand(1, qDef.maxAttempts)
          : status === 'completed' ? 1 : 1;

        const claimedBy = ['running','completed'].includes(status) && workerIds.length > 0
          ? pick(workerIds.slice(0, Math.min(workerIds.length, 3))) : null;

        const errorMsg = ['failed','dead_letter'].includes(status) ? pick(ERRORS) : null;

        jobDocs.push({
          id: jobId,
          queue_id: qId,
          type,
          payload: p,
          priority: rand(0, 10),
          status,
          run_at: runAt,
          attempt_count: attemptCount,
          max_attempts: qDef.maxAttempts,
          claimed_by: claimedBy,
          started_at: startedAt,
          completed_at: completedAt,
          result: completedAt ? { success: true, duration_ms: durationMs, processed_at: completedAt.toISOString() } : null,
          error: errorMsg,
          batch_id: null,
          created_at: createdAt,
          updated_at: completedAt ?? startedAt ?? createdAt,
        });

        // Job executions (one per attempt)
        for (let attempt = 1; attempt <= attemptCount; attempt++) {
          const isLast = attempt === attemptCount;
          const execStatus = isLast
            ? (status === 'completed' ? 'completed' : status === 'running' ? 'running' : 'failed')
            : 'failed';
          const execStart = new Date((startedAt ?? createdAt).getTime() + (attempt - 1) * rand(5000,30_000));
          const execEnd   = execStatus !== 'running' ? new Date(execStart.getTime() + rand(100, 30_000)) : null;
          executionDocs.push({
            id: uuidv4(),
            job_id: jobId,
            worker_id: claimedBy ?? (workerIds.length ? pick(workerIds) : null),
            attempt_number: attempt,
            status: execStatus,
            started_at: execStart,
            finished_at: execEnd,
            duration_ms: execEnd ? execEnd.getTime() - execStart.getTime() : null,
            error: execStatus === 'failed' ? pick(ERRORS) : null,
            result: execStatus === 'completed' ? { success: true } : null,
          });
        }

        if (status === 'dead_letter') {
          dlCandidates.push({ jobId, queueId: qId, type, p, attempts: attemptCount, error: errorMsg! });
        }
      }

      if (jobDocs.length)       await db.collection('jobs').insertMany(jobDocs);
      if (executionDocs.length) await db.collection('job_executions').insertMany(executionDocs);
      totalJobs += jobDocs.length;
    }
    console.log(`  ✓ ${totalJobs} jobs + executions`);

    // ── Dead letter entries ───────────────────────────────────────────────────
    if (dlCandidates.length) {
      await db.collection('dead_letter_entries').insertMany(
        dlCandidates.map(d => ({
          id: uuidv4(),
          original_job_id: d.jobId,
          queue_id: d.queueId,
          type: d.type,
          payload: d.p,
          attempt_count: d.attempts,
          last_error: d.error,
          moved_at: minsAgo(rand(1,1440)),
        }))
      );
      console.log(`  ✓ ${dlCandidates.length} dead letter entries`);
    }
  } // end project loop

  console.log('\n✅  Seed complete!');
  console.log(`   Email:    ${DEMO_EMAIL}`);
  console.log(`   Password: ${DEMO_PASSWORD}`);
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
