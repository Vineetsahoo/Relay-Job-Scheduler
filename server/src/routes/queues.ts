import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/client';
import { asyncHandler, ApiError } from '../middleware/errors';
import { assertProjectAccess } from './projects';

const router = Router();

/** Throws 403 unless the user can access the project that owns this queue. */
async function assertQueueAccess(userId: string, queueId: string): Promise<string> {
  const db = getDb();
  const queue = await db.collection('queues').findOne({ id: queueId });
  if (!queue) throw new ApiError(403, 'No access to this queue');
  await assertProjectAccess(userId, queue.project_id as string);
  return queue.project_id as string;
}

const createQueueSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  priority: z.number().int().default(0),
  concurrency_limit: z.number().int().min(1).default(5),
  retry_policy: z
    .object({
      strategy: z.enum(['fixed', 'linear', 'exponential']),
      base_delay_seconds: z.number().int().min(1).default(10),
      max_delay_seconds: z.number().int().min(1).default(3600),
      max_attempts: z.number().int().min(0).default(5),
    })
    .optional(),
});

// POST /api/queues — creates a queue, optionally with an inline retry policy
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createQueueSchema.parse(req.body);
    await assertProjectAccess(req.user!.id, body.project_id);

    const db = getDb();
    const now = new Date();

    let retryPolicyId: string | null = null;
    if (body.retry_policy) {
      const rp = body.retry_policy;
      const policy = {
        id: uuidv4(),
        name: `${body.name}-policy`,
        strategy: rp.strategy,
        base_delay_seconds: rp.base_delay_seconds,
        max_delay_seconds: rp.max_delay_seconds,
        max_attempts: rp.max_attempts,
        created_at: now,
      };
      await db.collection('retry_policies').insertOne(policy);
      retryPolicyId = policy.id;
    }

    const queue = {
      id: uuidv4(),
      project_id: body.project_id,
      name: body.name,
      priority: body.priority,
      concurrency_limit: body.concurrency_limit,
      is_paused: false,
      retry_policy_id: retryPolicyId,
      created_at: now,
    };

    await db.collection('queues').insertOne(queue);

    // Attach retry policy fields inline if present
    const retryPolicy = retryPolicyId
      ? await db.collection('retry_policies').findOne({ id: retryPolicyId })
      : null;

    const { _id, ...queueData } = queue as any;
    res.status(201).json({
      ...queueData,
      ...(retryPolicy
        ? {
            strategy: retryPolicy.strategy,
            base_delay_seconds: retryPolicy.base_delay_seconds,
            max_delay_seconds: retryPolicy.max_delay_seconds,
            max_attempts: retryPolicy.max_attempts,
          }
        : {}),
    });
  })
);

// GET /api/queues?project_id=...
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const projectId = req.query.project_id as string | undefined;
    if (!projectId) throw new ApiError(400, 'project_id query param is required');
    await assertProjectAccess(req.user!.id, projectId);

    const db = getDb();
    const queues = await db
      .collection('queues')
      .find({ project_id: projectId })
      .sort({ priority: -1, created_at: 1 })
      .toArray();

    // Attach per-queue job stats
    const data = await Promise.all(
      queues.map(async (q) => {
        const [queuedCount, runningCount, completedCount, deadLetterCount] = await Promise.all([
          db.collection('jobs').countDocuments({ queue_id: q.id, status: { $in: ['queued', 'retrying'] } }),
          db.collection('jobs').countDocuments({ queue_id: q.id, status: { $in: ['claimed', 'running'] } }),
          db.collection('jobs').countDocuments({ queue_id: q.id, status: 'completed' }),
          db.collection('jobs').countDocuments({ queue_id: q.id, status: 'dead_letter' }),
        ]);

        const retryPolicy = q.retry_policy_id
          ? await db.collection('retry_policies').findOne({ id: q.retry_policy_id })
          : null;

        const { _id, ...queueData } = q as any;
        return {
          ...queueData,
          ...(retryPolicy
            ? {
                strategy: retryPolicy.strategy,
                base_delay_seconds: retryPolicy.base_delay_seconds,
                max_delay_seconds: retryPolicy.max_delay_seconds,
                max_attempts: retryPolicy.max_attempts,
              }
            : {}),
          queued_count: queuedCount,
          running_count: runningCount,
          completed_count: completedCount,
          dead_letter_count: deadLetterCount,
        };
      })
    );

    res.json({ data });
  })
);

// GET /api/queues/:id — includes live stats
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertQueueAccess(req.user!.id, req.params.id);

    const db = getDb();
    const queue = await db.collection('queues').findOne({ id: req.params.id });
    if (!queue) throw new ApiError(404, 'Queue not found');

    const retryPolicy = queue.retry_policy_id
      ? await db.collection('retry_policies').findOne({ id: queue.retry_policy_id })
      : null;

    // Stats grouped by status
    const statsPipeline = await db
      .collection('jobs')
      .aggregate([
        { $match: { queue_id: req.params.id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .toArray();

    const stats_by_status = statsPipeline.map((s) => ({ status: s._id, count: s.count }));

    const { _id, ...queueData } = queue as any;
    res.json({
      ...queueData,
      ...(retryPolicy
        ? {
            strategy: retryPolicy.strategy,
            base_delay_seconds: retryPolicy.base_delay_seconds,
            max_delay_seconds: retryPolicy.max_delay_seconds,
            max_attempts: retryPolicy.max_attempts,
          }
        : {}),
      stats_by_status,
    });
  })
);

const updateQueueSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  priority: z.number().int().optional(),
  concurrency_limit: z.number().int().min(1).optional(),
  is_paused: z.boolean().optional(),
});

// PATCH /api/queues/:id — update config, or pause/resume
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertQueueAccess(req.user!.id, req.params.id);
    const body = updateQueueSchema.parse(req.body);

    const fields = Object.keys(body) as (keyof typeof body)[];
    if (fields.length === 0) throw new ApiError(400, 'No fields to update');

    const db = getDb();
    const updates: Record<string, any> = {};
    for (const f of fields) updates[f] = body[f];

    const result = await db
      .collection('queues')
      .findOneAndUpdate({ id: req.params.id }, { $set: updates }, { returnDocument: 'after' });

    if (!result) throw new ApiError(404, 'Queue not found');
    const { _id, ...data } = result as any;
    res.json(data);
  })
);

// DELETE /api/queues/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertQueueAccess(req.user!.id, req.params.id);
    const db = getDb();
    await db.collection('queues').deleteOne({ id: req.params.id });
    res.status(204).send();
  })
);

export { assertQueueAccess };
export default router;
