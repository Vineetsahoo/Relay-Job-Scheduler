import { Router } from 'express';
import { getDb } from '../db/client';
import { asyncHandler, ApiError } from '../middleware/errors';
import { assertQueueAccess } from './queues';

const router = Router();

// GET /api/dead-letter?queue_id=...
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const queueId = req.query.queue_id as string;
    if (!queueId) throw new ApiError(400, 'queue_id query param is required');
    await assertQueueAccess(req.user!.id, queueId);

    const db = getDb();
    const entries = await db
      .collection('dead_letter_entries')
      .find({ queue_id: queueId })
      .sort({ moved_at: -1 })
      .toArray();

    // Attach the current status of the original job so the UI knows if it was
    // already retried (status will be 'queued'/'running'/'completed' etc.)
    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const job = await db
          .collection('jobs')
          .findOne({ id: entry.original_job_id }, { projection: { status: 1 } });
        const { _id, ...e } = entry as any;
        return { ...e, current_job_status: job?.status ?? 'unknown' };
      })
    );

    res.json({ data: enriched });
  })
);

// DELETE /api/dead-letter/:id — purge a single DLQ entry (no retry, just discard)
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const entry = await db.collection('dead_letter_entries').findOne({ id: req.params.id });
    if (!entry) throw new ApiError(404, 'Dead letter entry not found');

    await assertQueueAccess(req.user!.id, entry.queue_id as string);
    await db.collection('dead_letter_entries').deleteOne({ id: req.params.id });
    res.status(204).send();
  })
);

// DELETE /api/dead-letter?queue_id=... — purge ALL entries for a queue
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const queueId = req.query.queue_id as string;
    if (!queueId) throw new ApiError(400, 'queue_id query param is required');
    await assertQueueAccess(req.user!.id, queueId);

    const db = getDb();
    const result = await db.collection('dead_letter_entries').deleteMany({ queue_id: queueId });
    res.json({ deleted: result.deletedCount });
  })
);

export default router;
