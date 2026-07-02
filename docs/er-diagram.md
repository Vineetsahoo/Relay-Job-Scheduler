# Entity-Relationship Diagram

The database is MongoDB. Collections mirror the relational schema below
(each entity is a MongoDB collection; `id` fields are UUIDs rather than
ObjectIds, kept for API compatibility). The init script is `db/init-mongo.js`.
The original PostgreSQL schema is preserved in `db/schema.sql` for reference.

```mermaid
erDiagram
    USERS ||--o{ ORGANIZATION_MEMBERS : "belongs to"
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : "has"
    ORGANIZATIONS ||--o{ PROJECTS : "owns"
    PROJECTS ||--o{ QUEUES : "owns"
    RETRY_POLICIES ||--o{ QUEUES : "configures"
    QUEUES ||--o{ JOBS : "contains"
    QUEUES ||--o{ SCHEDULED_JOBS : "has cron templates"
    SCHEDULED_JOBS ||--o{ JOBS : "materializes"
    JOBS ||--o{ JOB_EXECUTIONS : "has attempts"
    JOBS ||--o{ JOB_LOGS : "has log lines"
    JOB_EXECUTIONS ||--o{ JOB_LOGS : "has log lines"
    WORKERS ||--o{ JOB_EXECUTIONS : "runs"
    WORKERS ||--o{ WORKER_HEARTBEATS : "reports"
    JOBS ||--o{ DEAD_LETTER_ENTRIES : "moves to on exhaustion"
    QUEUES ||--o{ DEAD_LETTER_ENTRIES : "contains"

    USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar name
        timestamptz created_at
    }
    ORGANIZATIONS {
        uuid id PK
        varchar name
        uuid created_by FK
        timestamptz created_at
    }
    ORGANIZATION_MEMBERS {
        uuid organization_id PK_FK
        uuid user_id PK_FK
        varchar role
        timestamptz joined_at
    }
    PROJECTS {
        uuid id PK
        uuid organization_id FK
        varchar name
        varchar api_key UK
        timestamptz created_at
    }
    RETRY_POLICIES {
        uuid id PK
        varchar name
        varchar strategy
        int base_delay_seconds
        int max_delay_seconds
        int max_attempts
    }
    QUEUES {
        uuid id PK
        uuid project_id FK
        varchar name
        int priority
        int concurrency_limit
        boolean is_paused
        uuid retry_policy_id FK
    }
    SCHEDULED_JOBS {
        uuid id PK
        uuid queue_id FK
        varchar name
        varchar cron_expression
        varchar job_type
        jsonb payload
        boolean is_active
        timestamptz next_run_at
        timestamptz last_run_at
    }
    JOBS {
        uuid id PK
        uuid queue_id FK
        uuid scheduled_job_id FK
        uuid batch_id
        varchar idempotency_key
        varchar type
        jsonb payload
        int priority
        varchar status
        timestamptz run_at
        int attempt_count
        int max_attempts
        uuid claimed_by FK
        timestamptz claimed_at
        timestamptz started_at
        timestamptz completed_at
        jsonb result
        text error
    }
    JOB_EXECUTIONS {
        uuid id PK
        uuid job_id FK
        uuid worker_id FK
        int attempt_number
        varchar status
        timestamptz started_at
        timestamptz finished_at
        int duration_ms
        text error
        jsonb result
    }
    JOB_LOGS {
        bigint id PK
        uuid job_id FK
        uuid execution_id FK
        varchar level
        text message
        timestamptz created_at
    }
    WORKERS {
        uuid id PK
        varchar name
        varchar hostname
        varchar status
        int concurrency
        int active_job_count
        timestamptz started_at
        timestamptz last_heartbeat_at
    }
    WORKER_HEARTBEATS {
        bigserial id PK
        uuid worker_id FK
        int active_jobs
        timestamptz created_at
    }
    DEAD_LETTER_ENTRIES {
        uuid id PK
        uuid original_job_id FK
        uuid queue_id FK
        varchar type
        jsonb payload
        int attempt_count
        text last_error
        timestamptz moved_at
    }
```

## Design notes

**Keys.** Every collection uses a `uuid` string `id` field as the logical
primary key (generated with the `uuid` package), stored alongside MongoDB's
native `_id`. UUIDs are used throughout for API-level identifiers to avoid
exposing sequential internal IDs and to allow client-side pre-generation.
High-write, append-only collections (`job_logs`, `worker_heartbeats`) also
use UUIDs for consistency.

**References & cascading.** MongoDB has no native foreign-key cascade.
Reference integrity is enforced at the application layer. Deleting a queue
or project requires the application to clean up downstream documents
(jobs, executions, logs). The schema is designed so that an entry in
`dead_letter_entries` carries its own denormalized `payload`, `type`, and
`last_error`, so the audit trail survives even if the original job document
is later purged.

**Normalization.** The document model is deliberately flat where practical —
retry policy fields are stored in a `retry_policies` collection and
referenced by `id` from queues, but `jobs.max_attempts` is copied at
job-creation time (intentional denormalization): if an operator changes a
queue's retry policy, jobs already in flight should keep behaving under the
policy they were created under.

**Indexes.** The single most important index is the partial index on `jobs`
covering the claimable subset:

```js
db.jobs.createIndex(
  { queue_id: 1, status: 1, run_at: 1, priority: -1 },
  { partialFilterExpression: { status: { $in: ['queued', 'retrying'] } } }
);
```

This partial index only covers the small, active set of documents a worker
needs to scan — not the ever-growing mass of `completed` history. The
unique partial index on `(queue_id, idempotency_key)` (where not null)
enforces idempotent job creation at the database level.

**Performance considerations at scale.** For very high job volumes, the next
steps would be: sharding the `jobs` collection by `queue_id`, archiving old
`completed`/`failed` documents to a separate collection or time-series
store, and moving `job_logs` to a dedicated log store (e.g. MongoDB Atlas
Search or an external observability platform).
