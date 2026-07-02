# Design Decisions

This project was deliberately scoped to be **basic and easy to understand**
rather than maximally feature-complete — the goal was a system where every
piece of reliability-critical logic (claiming, retries, DLQ, graceful
shutdown) is something you can read top-to-bottom in one file and understand,
rather than something spread across abstraction layers. Below are the
trade-offs that scoping decision implies, and what a production version
would add.

## MongoDB as the only infrastructure dependency

**Decision:** No Redis, no RabbitMQ/Kafka, no separate lock/coordination
service — just MongoDB, used both as the system of record and as the queue
itself, via `findOneAndUpdate` atomic status transitions.

**Why:** MongoDB's document-level locking makes `findOneAndUpdate` genuinely
atomic. When two workers race to claim the same job, the first writer to
flip `status: 'queued' → 'claimed'` wins and gets the document back; the
second writer's query finds no matching document (because `status` is no
longer `queued`) and returns null. This is a real, production-grade
concurrency primitive — exactly the approach used by MongoDB-backed queue
libraries like Agenda and Mongoose-Queue.

**Trade-off:** A PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` or a
dedicated message broker would give higher throughput at very high job
volumes and push-based delivery (no polling latency). For this project's
scope, the 2-second poll interval's latency is a completely acceptable cost
for not running a second piece of infrastructure. If throughput became the
bottleneck, the poll loop is the one piece of the worker you'd swap out
first — everything downstream of "here is a claimed job" stays the same.

## Worker and API server are separate processes, single codebase

**Decision:** `src/index.ts` (API) and `src/worker.ts` (worker) are two
entrypoints in the same TypeScript project, sharing the retry/handler logic,
rather than either being merged into one process or split into separate
repos/packages.

**Why:** Job execution needs to scale independently of API request volume —
a burst of slow jobs shouldn't be able to starve API responsiveness, and
vice versa. Separate processes (potentially separate machines) solve that.
Sharing a codebase avoids the overhead of a second `package.json`/CI
pipeline/versioning scheme for what is, at this scope, a small amount of
shared logic.

**Trade-off:** At much larger scale you'd likely want the worker split into
its own deployable package with its own dependency tree (it doesn't need
`express` or `cors`, for instance), so the two can be released and scaled
completely independently. Not worth the ceremony here.

## Per-queue concurrency limiting via application-level round-trips

**Decision:** The worker first queries each active queue's current
running-job count, then issues one `findOneAndUpdate` claim per job slot
available in that queue — rather than one giant cross-queue atomic operation.

**Why:** Readability. A single operation that correctly enforces per-queue
concurrency limits *and* cross-queue priority *and* atomic claiming
simultaneously would be a complex aggregation pipeline. Splitting it into
"one simple, well-understood findOneAndUpdate, looped over queues in
priority order" trades a small amount of round-trip latency for code a new
engineer can read in thirty seconds.

**Trade-off:** More database round trips per poll cycle. At the job volumes
this system is designed for, that's negligible.

## Crashed workers aren't automatically detected and requeued

**Decision:** If a worker process dies mid-execution (not via graceful
`SIGTERM`, but a hard crash or `kill -9`), its claimed jobs stay in
`claimed`/`running` status indefinitely. The Workers page will show that
worker's heartbeat going stale, and an operator can identify and manually
retry the affected jobs via the dashboard's retry button.

**Why:** Automatically reclaiming a "stuck" job is the single easiest place
for a scheduler to introduce silent double-execution bugs — a worker that's
just slow (a long HTTP call, GC pause) looks identical from the outside to a
worker that's actually dead, and if both a "watchdog" and the *original*
slow worker eventually try to finish the same job, you get exactly the kind
of subtle bug this project is trying to demonstrate how to avoid.

**Trade-off:** A production system would add a **lease/lock timeout**: the
claim query would set `claimed_at` and a `lease_expires_at`; a periodic
reaper job would look for `status='claimed' AND lease_expires_at < now()`
and requeue those, likely combined with a fencing token so a since-recovered
original worker can detect it's been superseded and abandon its result
rather than writing it. This is the most significant piece of reliability
machinery intentionally left out of this "basic" build, and it's the first
thing to add if this went to production.

## Polling instead of WebSockets for the dashboard

**Decision:** The React dashboard re-fetches on a `setInterval` (3-5 seconds
depending on the page) rather than subscribing to a WebSocket or SSE stream.

**Why:** Polling is dramatically simpler to build, debug, and reason about
— no connection lifecycle, no reconnect/backoff logic, no server-side
pub/sub fan-out to design. For a job scheduler where a few seconds of
staleness is completely acceptable (nobody needs sub-second updates on
"is my batch job done yet"), it's the right amount of engineering.

**Trade-off:** Higher constant request volume, and updates are not
instantaneous. Real-time push (WebSockets, listed as a bonus feature) would
be the natural upgrade if the dashboard needed to feel "live" for
fast-moving operational monitoring.

## No arbitrary user code execution

**Decision:** Jobs reference a `type` string that maps to a handler function
registered in the worker's codebase (`src/jobs/handlers.ts`), rather than
accepting arbitrary code/scripts to execute.

**Why:** Executing arbitrary user-submitted code safely requires sandboxing
(containers, gVisor, WASM, etc.) that's a substantial project on its own and
orthogonal to what this assignment is evaluating. The handler-registry
pattern is also how most real job schedulers actually work in practice
(Sidekiq, BullMQ, Celery all work this way) — you deploy your worker fleet
with the handler code baked in, and jobs just carry a type + payload.

## What was deliberately left out (and why)

Per the assignment's own evaluation criteria — engineering quality over
feature count — the following bonus features were intentionally not
implemented, in favor of spending the time budget on making the core
lifecycle, concurrency handling, and documentation solid:

- **Workflow dependencies (DAGs)** — a real feature, but a genuinely separate
  subsystem (dependency graph resolution, partial-failure semantics) that
  would have doubled the scope without deepening the core reliability story.
- **Rate limiting / distributed locking beyond job claiming** — the
  `SKIP LOCKED` claim mechanism *is* a form of distributed locking; a
  general-purpose distributed lock service for arbitrary application use is
  a different, broader problem.
- **Queue sharding** — not meaningful at the scale a single-Postgres-instance
  system targets; see the ER diagram doc's performance-considerations
  section for what this would look like if job volume grew far past what a
  single Postgres instance could serve.
- **Role-based access control** — organizations currently have `owner` /
  `admin` / `member` roles stored in the schema, but every route only checks
  *membership*, not role — a real RBAC layer (e.g. only owners can delete a
  project) was cut to keep the auth middleware simple to read.
- **AI-generated failure summaries** — genuinely useful, but adds an external
  API dependency (and cost) to a project whose core value is demonstrating
  scheduler mechanics, not LLM integration.
