# API Reference

Base URL: `http://localhost:4000` (or wherever you deploy the server).

All endpoints except `/api/auth/*` and `/health` require:
```
Authorization: Bearer <jwt-token>
```

All error responses look like:
```json
{ "error": "Human-readable message" }
```
or, for validation errors:
```json
{ "error": "Validation failed", "details": [{ "path": "email", "message": "Invalid email" }] }
```

---

## Auth

### `POST /api/auth/register`
Creates a user **and** their first organization in one call.

```json
// request
{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "hunter2222", "organization_name": "Analytical Engines Ltd" }

// response 201
{ "user": {...}, "organization": {...}, "token": "eyJ..." }
```

### `POST /api/auth/login`
```json
{ "email": "ada@example.com", "password": "hunter2222" }
// -> { "user": {...}, "token": "eyJ..." }
```

---

## Organizations & Projects

| Method | Path | Description |
|---|---|---|
| GET | `/api/organizations` | Organizations the current user belongs to |
| POST | `/api/projects` | Create a project. Body: `{ organization_id, name }` |
| GET | `/api/projects?organization_id=` | List projects in an org |
| GET | `/api/projects/:id` | Project detail (includes `api_key`) |

---

## Queues

| Method | Path | Description |
|---|---|---|
| POST | `/api/queues` | Create a queue, optionally with an inline retry policy |
| GET | `/api/queues?project_id=` | List queues with live job-count stats |
| GET | `/api/queues/:id` | Queue detail + stats grouped by status |
| PATCH | `/api/queues/:id` | Update config, or pause/resume (`is_paused`) |
| DELETE | `/api/queues/:id` | Delete a queue (cascades to its jobs) |

**Create queue example:**
```json
POST /api/queues
{
  "project_id": "uuid",
  "name": "emails",
  "priority": 10,
  "concurrency_limit": 5,
  "retry_policy": {
    "strategy": "exponential",
    "base_delay_seconds": 30,
    "max_delay_seconds": 3600,
    "max_attempts": 5
  }
}
```

**Pause a queue:**
```json
PATCH /api/queues/:id
{ "is_paused": true }
```

---

## Jobs

| Method | Path | Description |
|---|---|---|
| POST | `/api/jobs` | Create a single job (immediate / delayed / scheduled) |
| POST | `/api/jobs/batch` | Create many jobs sharing one `batch_id` |
| POST | `/api/jobs/recurring` | Create a cron-based recurring job template |
| GET | `/api/jobs/recurring?queue_id=` | List recurring templates for a queue |
| PATCH | `/api/jobs/recurring/:id` | Pause/resume a recurring template (`is_active`) |
| GET | `/api/jobs?queue_id=&status=&page=&limit=` | List jobs, filtered + paginated |
| GET | `/api/jobs/:id` | Job detail, including executions and logs |
| POST | `/api/jobs/:id/retry` | Manually requeue a failed / dead-lettered / cancelled job |
| POST | `/api/jobs/:id/cancel` | Cancel a job that hasn't started running yet |

**Immediate job:**
```json
POST /api/jobs
{ "queue_id": "uuid", "type": "log_message", "payload": { "message": "hi" } }
```

**Delayed job** (run in 5 minutes):
```json
POST /api/jobs
{ "queue_id": "uuid", "type": "log_message", "payload": {}, "delay_seconds": 300 }
```

**Scheduled job** (run at an absolute time):
```json
POST /api/jobs
{ "queue_id": "uuid", "type": "log_message", "payload": {}, "run_at": "2026-08-01T09:00:00Z" }
```

**Idempotent job creation** — if a job with the same `idempotency_key` already
exists on this queue, the existing job is returned instead of creating a
duplicate:
```json
POST /api/jobs
{ "queue_id": "uuid", "type": "send_receipt", "payload": {...}, "idempotency_key": "order-4471" }
```

**Batch:**
```json
POST /api/jobs/batch
{
  "queue_id": "uuid",
  "jobs": [
    { "type": "resize_image", "payload": { "url": "..." } },
    { "type": "resize_image", "payload": { "url": "..." } }
  ]
}
```

**Recurring (cron) job template:**
```json
POST /api/jobs/recurring
{
  "queue_id": "uuid",
  "name": "nightly-report",
  "cron_expression": "0 2 * * *",
  "job_type": "generate_report",
  "payload": { "report": "daily-summary" }
}
```
The worker's scheduler loop checks every 15 seconds for templates whose
`next_run_at` has passed, materializes a real `jobs` row, and advances
`next_run_at` to the next cron occurrence.

**List with filtering + pagination:**
```
GET /api/jobs?queue_id=uuid&status=failed&page=2&limit=20
```
```json
{
  "data": [...],
  "pagination": { "page": 2, "limit": 20, "total": 143, "total_pages": 8 }
}
```

---

## Workers

| Method | Path | Description |
|---|---|---|
| GET | `/api/workers` | All registered workers, with an `is_stale` flag (no heartbeat in 15s) |
| GET | `/api/workers/:id/heartbeats` | Last 50 heartbeats for a worker (for a sparkline) |

---

## Dead Letter Queue

| Method | Path | Description |
|---|---|---|
| GET | `/api/dead-letter?queue_id=` | Permanently-failed jobs for a queue |

To retry one, call `POST /api/jobs/:original_job_id/retry` — the dashboard's
"Retry" button on this page does exactly that.

---

## Dashboard aggregation

| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard/summary?project_id=` | Job counts by status, queue count, active worker count |
| GET | `/api/dashboard/throughput?project_id=&hours=24` | Completed/failed counts bucketed by hour |

---

## Available job `type`s (worker handler registry)

These are the demo handlers registered in `server/src/jobs/handlers.ts`. Add
your own by adding a function to that file's `handlers` object — the `type`
string on a job is looked up there at execution time.

| type | payload | behavior |
|---|---|---|
| `log_message` | `{ message }` | Writes a log line. Good smoke test. |
| `sleep` | `{ ms }` | Waits `ms` (default 1000), then completes. |
| `http_request` | `{ url, method? }` | Performs a real outbound HTTP request. |
| `fail_randomly` | `{ fail_rate }` | Fails with probability `fail_rate` (default 0.7). Useful for demoing retries and the DLQ. |
