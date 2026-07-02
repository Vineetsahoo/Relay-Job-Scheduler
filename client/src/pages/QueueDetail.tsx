import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Job, Queue, ScheduledJob, JobStatus } from '../api/types';
import { JobStatusBadge, relativeTime } from '../components/StatusUI';
import { Modal } from '../components/Modal';

const STATUS_FILTERS: (JobStatus | 'all')[] = [
  'all', 'queued', 'scheduled', 'claimed', 'running', 'retrying', 'completed', 'failed', 'dead_letter', 'cancelled',
];

export function QueueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Queue | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([]);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [tab, setTab] = useState<'jobs' | 'recurring'>('jobs');

  async function loadQueue() {
    if (!id) return;
    const res = await api.get(`/api/queues/${id}`);
    setQueue(res);
  }

  async function loadJobs(page = 1) {
    if (!id) return;
    const statusQuery = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
    const res = await api.get(`/api/jobs?queue_id=${id}&page=${page}&limit=20${statusQuery}`);
    setJobs(res.data);
    setPagination(res.pagination);
  }

  async function loadRecurring() {
    if (!id) return;
    const res = await api.get(`/api/jobs/recurring?queue_id=${id}`);
    setScheduledJobs(res.data);
  }

  useEffect(() => {
    loadQueue();
    loadJobs();
    loadRecurring();
    const interval = setInterval(() => {
      loadQueue();
      loadJobs(pagination.page);
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, statusFilter]);

  async function retryJob(jobId: string) {
    await api.post(`/api/jobs/${jobId}/retry`);
    loadJobs(pagination.page);
  }

  if (!queue) return <div className="empty-state">Loading…</div>;

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">{queue.name}</h1>
          <div className="page-subtitle">
            priority {queue.priority} · concurrency {queue.concurrency_limit} · {queue.strategy ?? 'fixed'} retries
            {queue.is_paused && <span style={{ color: 'var(--accent)' }}> · paused</span>}
          </div>
        </div>
        <div className="row" style={{ flex: 'none', gap: 8 }}>
          <button className="btn" onClick={() => setShowRecurring(true)}>+ Recurring job</button>
          <button className="btn btn-primary" onClick={() => setShowCreateJob(true)}>+ New job</button>
        </div>
      </div>

      <div className="pill-toggle" style={{ marginBottom: 18 }}>
        <button className={tab === 'jobs' ? 'active' : ''} onClick={() => setTab('jobs')}>Job explorer</button>
        <button className={tab === 'recurring' ? 'active' : ''} onClick={() => setTab('recurring')}>
          Recurring ({scheduledJobs.length})
        </button>
      </div>

      {tab === 'jobs' ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                className={`filter-chip${statusFilter === s ? ' active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>

          {jobs.length === 0 ? (
            <div className="empty-state">No jobs match this filter.</div>
          ) : (
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Run at</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="clickable" onClick={() => navigate(`/jobs/${job.id}`)}>
                      <td className="mono">{job.type}</td>
                      <td><JobStatusBadge status={job.status} /></td>
                      <td className="mono">{job.attempt_count}/{job.max_attempts}</td>
                      <td className="text-secondary">{relativeTime(job.run_at)}</td>
                      <td className="text-secondary">{relativeTime(job.completed_at || job.started_at || job.created_at)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {['failed', 'dead_letter', 'cancelled'].includes(job.status) && (
                          <button className="btn btn-sm" onClick={() => retryJob(job.id)}>Retry</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination.total_pages > 1 && (
            <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 16, flex: 'none' }}>
              <button
                className="btn btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => loadJobs(pagination.page - 1)}
              >
                Previous
              </button>
              <span className="text-secondary" style={{ fontSize: 12.5, alignSelf: 'center' }}>
                Page {pagination.page} of {pagination.total_pages} ({pagination.total} jobs)
              </span>
              <button
                className="btn btn-sm"
                disabled={pagination.page >= pagination.total_pages}
                onClick={() => loadJobs(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          {scheduledJobs.length === 0 ? (
            <div className="empty-state">No recurring jobs configured for this queue.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Cron</th>
                  <th>Job type</th>
                  <th>Next run</th>
                  <th>Last run</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {scheduledJobs.map((sj) => (
                  <tr key={sj.id}>
                    <td style={{ fontWeight: 600 }}>{sj.name}</td>
                    <td className="mono">{sj.cron_expression}</td>
                    <td className="mono">{sj.job_type}</td>
                    <td className="text-secondary">{relativeTime(sj.next_run_at)}</td>
                    <td className="text-secondary">{relativeTime(sj.last_run_at)}</td>
                    <td>{sj.is_active ? 'Active' : 'Paused'}</td>
                    <td>
                      <button
                        className="btn btn-sm"
                        onClick={async () => {
                          await api.patch(`/api/jobs/recurring/${sj.id}`, { is_active: !sj.is_active });
                          loadRecurring();
                        }}
                      >
                        {sj.is_active ? 'Pause' : 'Resume'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showCreateJob && (
        <CreateJobModal queueId={queue.id} onClose={() => setShowCreateJob(false)} onCreated={() => loadJobs(1)} />
      )}
      {showRecurring && (
        <CreateRecurringModal queueId={queue.id} onClose={() => setShowRecurring(false)} onCreated={loadRecurring} />
      )}
    </div>
  );
}

function CreateJobModal({ queueId, onClose, onCreated }: { queueId: string; onClose: () => void; onCreated: () => void }) {
  const [timing, setTiming] = useState<'immediate' | 'delayed' | 'scheduled' | 'batch'>('immediate');
  const [type, setType] = useState('log_message');
  const [payload, setPayload] = useState('{\n  "message": "hello from Relay"\n}');
  const [delaySeconds, setDelaySeconds] = useState(60);
  const [runAt, setRunAt] = useState('');
  const [batchCount, setBatchCount] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      setError('Payload must be valid JSON');
      return;
    }

    setSubmitting(true);
    try {
      if (timing === 'batch') {
        await api.post('/api/jobs/batch', {
          queue_id: queueId,
          jobs: Array.from({ length: batchCount }, () => ({ type, payload: parsedPayload })),
        });
      } else {
        await api.post('/api/jobs', {
          queue_id: queueId,
          type,
          payload: parsedPayload,
          ...(timing === 'delayed' ? { delay_seconds: delaySeconds } : {}),
          ...(timing === 'scheduled' && runAt ? { run_at: new Date(runAt).toISOString() } : {}),
        });
      }
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New job" onClose={onClose}>
      <div className="pill-toggle" style={{ marginBottom: 16 }}>
        {(['immediate', 'delayed', 'scheduled', 'batch'] as const).map((t) => (
          <button key={t} className={timing === t ? 'active' : ''} onClick={() => setTiming(t)}>{t}</button>
        ))}
      </div>

      <div className="field">
        <label>Job type (maps to a worker handler)</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="log_message">log_message</option>
          <option value="sleep">sleep</option>
          <option value="http_request">http_request</option>
          <option value="fail_randomly">fail_randomly (demo retries)</option>
        </select>
      </div>

      <div className="field">
        <label>Payload (JSON)</label>
        <textarea rows={4} value={payload} onChange={(e) => setPayload(e.target.value)} className="mono" />
      </div>

      {timing === 'delayed' && (
        <div className="field">
          <label>Run after (seconds)</label>
          <input type="number" min={0} value={delaySeconds} onChange={(e) => setDelaySeconds(Number(e.target.value))} />
        </div>
      )}
      {timing === 'scheduled' && (
        <div className="field">
          <label>Run at</label>
          <input type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} />
        </div>
      )}
      {timing === 'batch' && (
        <div className="field">
          <label>Number of jobs in this batch</label>
          <input type="number" min={1} max={1000} value={batchCount} onChange={(e) => setBatchCount(Number(e.target.value))} />
        </div>
      )}

      {error && <div className="error-text">{error}</div>}

      <div className="row spacer-top">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={submitting}>
          {submitting ? 'Creating…' : 'Create'}
        </button>
      </div>
    </Modal>
  );
}

function CreateRecurringModal({ queueId, onClose, onCreated }: { queueId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [cron, setCron] = useState('*/5 * * * *');
  const [type, setType] = useState('log_message');
  const [payload, setPayload] = useState('{}');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      setError('Payload must be valid JSON');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/jobs/recurring', {
        queue_id: queueId,
        name,
        cron_expression: cron,
        job_type: type,
        payload: parsedPayload,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New recurring job" onClose={onClose}>
      <div className="field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="nightly-cleanup" />
      </div>
      <div className="field">
        <label>Cron expression (5-field, UTC)</label>
        <input value={cron} onChange={(e) => setCron(e.target.value)} className="mono" />
      </div>
      <div className="field">
        <label>Job type</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="log_message">log_message</option>
          <option value="sleep">sleep</option>
          <option value="http_request">http_request</option>
        </select>
      </div>
      <div className="field">
        <label>Payload (JSON)</label>
        <textarea rows={3} value={payload} onChange={(e) => setPayload(e.target.value)} className="mono" />
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="row spacer-top">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={!name || submitting}>
          {submitting ? 'Creating…' : 'Create'}
        </button>
      </div>
    </Modal>
  );
}
