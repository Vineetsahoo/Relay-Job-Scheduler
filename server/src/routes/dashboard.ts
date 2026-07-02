import { Router } from 'express';
import { getDb } from '../db/client';
import { asyncHandler, ApiError } from '../middleware/errors';
import { assertProjectAccess } from './projects';

const router = Router();

// GET /api/dashboard/summary?project_id=...
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const projectId = req.query.project_id as string;
    if (!projectId) throw new ApiError(400, 'project_id query param is required');
    await assertProjectAccess(req.user!.id, projectId);

    const db = getDb();

    // Get all queue IDs for this project
    const queues = await db.collection('queues').find({ project_id: projectId }, { projection: { id: 1 } }).toArray();
    const queueIds = queues.map((q) => q.id as string);

    // Job counts grouped by status
    const jobCountsPipeline = await db
      .collection('jobs')
      .aggregate([
        { $match: { queue_id: { $in: queueIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .toArray();

    const jobs_by_status = jobCountsPipeline.map((r) => ({ status: r._id, count: r.count }));

    const staleThreshold = new Date(Date.now() - 15_000);

    const [queueCount, activeWorkerCount] = await Promise.all([
      db.collection('queues').countDocuments({ project_id: projectId }),
      db.collection('workers').countDocuments({
        status: 'online',
        last_heartbeat_at: { $gt: staleThreshold },
      }),
    ]);

    res.json({
      jobs_by_status,
      queue_count: queueCount,
      active_worker_count: activeWorkerCount,
    });
  })
);

// GET /api/dashboard/throughput?project_id=...&hours=24
// Completed/failed job counts bucketed by hour.
router.get(
  '/throughput',
  asyncHandler(async (req, res) => {
    const projectId = req.query.project_id as string;
    if (!projectId) throw new ApiError(400, 'project_id query param is required');
    await assertProjectAccess(req.user!.id, projectId);

    const hours = Math.min(168, Math.max(1, parseInt(String(req.query.hours ?? '24'), 10) || 24));

    const db = getDb();
    const queues = await db.collection('queues').find({ project_id: projectId }, { projection: { id: 1 } }).toArray();
    const queueIds = queues.map((q) => q.id as string);

    const since = new Date(Date.now() - hours * 3600 * 1000);

    const pipeline = await db
      .collection('jobs')
      .aggregate([
        {
          $match: {
            queue_id: { $in: queueIds },
            completed_at: { $ne: null, $gt: since },
          },
        },
        {
          $group: {
            _id: {
              $dateTrunc: { date: '$completed_at', unit: 'hour' },
            },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            failed: {
              $sum: {
                $cond: [{ $in: ['$status', ['failed', 'dead_letter']] }, 1, 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    const data = pipeline.map((r) => ({
      bucket: r._id,
      completed: r.completed,
      failed: r.failed,
    }));

    res.json({ data });
  })
);

export default router;
