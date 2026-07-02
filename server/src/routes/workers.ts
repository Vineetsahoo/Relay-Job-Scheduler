import { Router } from 'express';
import { getDb } from '../db/client';
import { asyncHandler } from '../middleware/errors';

const router = Router();

// GET /api/workers — all workers, with an "is_stale" flag if no heartbeat in 15s
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const staleThreshold = new Date(Date.now() - 15_000);

    const workers = await db.collection('workers').find().sort({ last_heartbeat_at: -1 }).toArray();

    const data = workers.map(({ _id, ...w }) => ({
      ...w,
      is_stale: (w.last_heartbeat_at as Date) < staleThreshold,
    }));

    res.json({ data });
  })
);

// GET /api/workers/:id/heartbeats — recent heartbeat history, for a sparkline
router.get(
  '/:id/heartbeats',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const heartbeats = await db
      .collection('worker_heartbeats')
      .find({ worker_id: req.params.id })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();

    res.json({ data: heartbeats.reverse().map(({ _id, ...h }) => h) });
  })
);

export default router;
