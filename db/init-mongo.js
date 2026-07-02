/**
 * MongoDB initialisation script — run once to create indexes.
 *
 *   mongosh "mongodb://localhost:27017/job_scheduler" db/init-mongo.js
 *
 * If you're using Atlas, replace the connection string accordingly.
 */

// Users
db.users.createIndex({ email: 1 }, { unique: true });

// Organizations
db.organizations.createIndex({ created_by: 1 });

// Organization members
db.organization_members.createIndex({ organization_id: 1, user_id: 1 }, { unique: true });
db.organization_members.createIndex({ user_id: 1 });

// Projects
db.projects.createIndex({ organization_id: 1 });
db.projects.createIndex({ api_key: 1 }, { unique: true });

// Retry policies (no special indexes needed)

// Queues
db.queues.createIndex({ project_id: 1 });
db.queues.createIndex({ project_id: 1, name: 1 }, { unique: true });

// Workers
db.workers.createIndex({ last_heartbeat_at: -1 });
db.workers.createIndex({ status: 1 });

// Worker heartbeats
db.worker_heartbeats.createIndex({ worker_id: 1, created_at: -1 });

// Scheduled jobs
db.scheduled_jobs.createIndex({ is_active: 1, next_run_at: 1 });
db.scheduled_jobs.createIndex({ queue_id: 1 });

// Jobs — the most important indexes
// Claimable jobs: used by the worker's findOneAndUpdate claim query
db.jobs.createIndex(
  { queue_id: 1, status: 1, run_at: 1, priority: -1 },
  { partialFilterExpression: { status: { $in: ['queued', 'retrying'] } } }
);
db.jobs.createIndex({ status: 1 });
db.jobs.createIndex({ batch_id: 1 }, { partialFilterExpression: { batch_id: { $ne: null } } });
db.jobs.createIndex(
  { queue_id: 1, idempotency_key: 1 },
  { unique: true, partialFilterExpression: { idempotency_key: { $ne: null } } }
);
db.jobs.createIndex({ queue_id: 1, completed_at: -1 }); // for throughput queries
db.jobs.createIndex({ scheduled_job_id: 1 });

// Job executions
db.job_executions.createIndex({ job_id: 1, attempt_number: 1 });

// Job logs
db.job_logs.createIndex({ job_id: 1, created_at: 1 });

// Dead letter entries
db.dead_letter_entries.createIndex({ queue_id: 1, moved_at: -1 });
db.dead_letter_entries.createIndex({ original_job_id: 1 });

print('MongoDB indexes created successfully.');
