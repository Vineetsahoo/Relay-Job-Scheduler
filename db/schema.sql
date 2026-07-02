-- ============================================================================
-- Distributed Job Scheduler — Database Schema (PostgreSQL / Supabase)
-- ============================================================================
-- Run this once in the Supabase SQL editor (or `psql $DATABASE_URL -f schema.sql`).
-- Design notes are in docs/design-decisions.md.
-- ============================================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ----------------------------------------------------------------------------
-- USERS
-- ----------------------------------------------------------------------------
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         varchar(255) not null unique,
  password_hash varchar(255) not null,
  name          varchar(255) not null,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ORGANIZATIONS  (a user can belong to many orgs; an org has many projects)
-- ----------------------------------------------------------------------------
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        varchar(255) not null,
  created_by  uuid not null references users(id) on delete restrict,
  created_at  timestamptz not null default now()
);

create table organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  role            varchar(20) not null default 'member' check (role in ('owner','admin','member')),
  joined_at       timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- ----------------------------------------------------------------------------
-- PROJECTS  (each project belongs to exactly one org; owns many queues)
-- ----------------------------------------------------------------------------
create table projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            varchar(255) not null,
  api_key         varchar(64) not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at      timestamptz not null default now()
);

create index idx_projects_org on projects(organization_id);

-- ----------------------------------------------------------------------------
-- RETRY POLICIES  (reusable, attached to a queue)
-- ----------------------------------------------------------------------------
create table retry_policies (
  id                  uuid primary key default gen_random_uuid(),
  name                varchar(100) not null,
  strategy            varchar(20) not null check (strategy in ('fixed','linear','exponential')),
  base_delay_seconds  int not null default 10,
  max_delay_seconds   int not null default 3600,
  max_attempts        int not null default 5,
  created_at          timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- QUEUES
-- ----------------------------------------------------------------------------
create table queues (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id) on delete cascade,
  name               varchar(255) not null,
  priority           int not null default 0,          -- higher = served first
  concurrency_limit  int not null default 5,           -- max jobs running at once for this queue
  is_paused          boolean not null default false,
  retry_policy_id    uuid references retry_policies(id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (project_id, name)
);

create index idx_queues_project on queues(project_id);

-- ----------------------------------------------------------------------------
-- WORKERS  (a running worker process instance)
-- ----------------------------------------------------------------------------
create table workers (
  id                uuid primary key default gen_random_uuid(),
  name              varchar(255) not null,
  hostname          varchar(255),
  status            varchar(20) not null default 'online' check (status in ('online','offline','draining')),
  concurrency       int not null default 5,            -- max jobs this worker will run concurrently
  active_job_count  int not null default 0,
  started_at        timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now()
);

create index idx_workers_heartbeat on workers(last_heartbeat_at);

create table worker_heartbeats (
  id          bigserial primary key,
  worker_id   uuid not null references workers(id) on delete cascade,
  active_jobs int not null,
  created_at  timestamptz not null default now()
);

create index idx_heartbeats_worker_time on worker_heartbeats(worker_id, created_at desc);

-- ----------------------------------------------------------------------------
-- SCHEDULED JOBS  (recurring cron templates — the worker's scheduler loop
-- reads these and materializes rows into `jobs` when a cron tick is due)
-- ----------------------------------------------------------------------------
create table scheduled_jobs (
  id                uuid primary key default gen_random_uuid(),
  queue_id          uuid not null references queues(id) on delete cascade,
  name              varchar(255) not null,
  cron_expression   varchar(100) not null,             -- standard 5-field cron
  job_type          varchar(100) not null,
  payload           jsonb not null default '{}',
  is_active         boolean not null default true,
  last_run_at       timestamptz,
  next_run_at       timestamptz not null,
  created_at        timestamptz not null default now()
);

create index idx_scheduled_jobs_due on scheduled_jobs(is_active, next_run_at);

-- ----------------------------------------------------------------------------
-- JOBS  (the core work item — every job type, immediate/delayed/scheduled/
-- batch/recurring, ends up as a row here)
-- ----------------------------------------------------------------------------
create table jobs (
  id               uuid primary key default gen_random_uuid(),
  queue_id         uuid not null references queues(id) on delete cascade,
  scheduled_job_id uuid references scheduled_jobs(id) on delete set null, -- set if spawned from a cron template
  batch_id         uuid,                                -- groups jobs submitted together
  idempotency_key  varchar(255),                         -- optional; caller-supplied de-dupe key

  type             varchar(100) not null,                -- maps to a handler in the worker's registry
  payload          jsonb not null default '{}',
  priority         int not null default 0,

  status           varchar(20) not null default 'queued'
                     check (status in ('scheduled','queued','claimed','running',
                                        'completed','failed','retrying','dead_letter','cancelled')),

  run_at           timestamptz not null default now(),   -- earliest time this job may be claimed
  attempt_count    int not null default 0,
  max_attempts     int not null default 5,                -- copied from queue's retry policy at creation time

  claimed_by       uuid references workers(id) on delete set null,
  claimed_at       timestamptz,
  started_at       timestamptz,
  completed_at     timestamptz,

  result           jsonb,
  error            text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- The single most important index: this is exactly the WHERE/ORDER BY the
-- worker's claim query uses, so claiming stays O(log n) even with millions
-- of historical (completed/failed) rows in the table.
create index idx_jobs_claimable on jobs(queue_id, status, run_at)
  where status in ('queued', 'retrying');

create index idx_jobs_status on jobs(status);
create index idx_jobs_batch on jobs(batch_id) where batch_id is not null;
create index idx_jobs_idempotency on jobs(queue_id, idempotency_key) where idempotency_key is not null;

-- ----------------------------------------------------------------------------
-- JOB EXECUTIONS  (one row per attempt — the retry history)
-- ----------------------------------------------------------------------------
create table job_executions (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references jobs(id) on delete cascade,
  worker_id       uuid references workers(id) on delete set null,
  attempt_number  int not null,
  status          varchar(20) not null check (status in ('running','completed','failed','timed_out')),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  duration_ms     int,
  error           text,
  result          jsonb
);

create index idx_executions_job on job_executions(job_id, attempt_number);

-- ----------------------------------------------------------------------------
-- JOB LOGS  (free-form log lines emitted during execution)
-- ----------------------------------------------------------------------------
create table job_logs (
  id            bigserial primary key,
  job_id        uuid not null references jobs(id) on delete cascade,
  execution_id  uuid references job_executions(id) on delete cascade,
  level         varchar(10) not null default 'info' check (level in ('info','warn','error')),
  message       text not null,
  created_at    timestamptz not null default now()
);

create index idx_logs_job on job_logs(job_id, created_at);

-- ----------------------------------------------------------------------------
-- DEAD LETTER ENTRIES  (permanent-failure snapshot, kept even if the
-- original job row is later purged — audit trail is independent of `jobs`)
-- ----------------------------------------------------------------------------
create table dead_letter_entries (
  id               uuid primary key default gen_random_uuid(),
  original_job_id  uuid not null references jobs(id) on delete cascade,
  queue_id         uuid not null references queues(id) on delete cascade,
  type             varchar(100) not null,
  payload          jsonb not null,
  attempt_count    int not null,
  last_error       text,
  moved_at         timestamptz not null default now()
);

create index idx_dlq_queue on dead_letter_entries(queue_id, moved_at desc);

-- ----------------------------------------------------------------------------
-- updated_at trigger for jobs
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_jobs_updated_at
  before update on jobs
  for each row execute function set_updated_at();
