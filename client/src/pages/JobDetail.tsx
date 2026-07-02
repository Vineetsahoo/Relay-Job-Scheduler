import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Job } from '../api/types';
import { JobStatusBadge, relativeTime } from '../components/StatusUI';

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);

  async function load() {
    if (!id) return;
    const res = await api.get(`/api/jobs/${id}`);
    setJob(res);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function retry() {
    await api.post(`/api/jobs/${id}/retry`);
    load();
  }

  async function cancel() {
    await api.post(`/api/jobs/${id}/cancel`);
    load();
  }

  if (!job) return <div className="empty-state">Loading…</div>;

  return (
    <div>
      <div className="topbar">
        <div>
          <button className="btn btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}>← Back</button>
          <h1 className="page-title mono" style={{ fontSize: 17 }}>{job.type}</h1>
          <div className="page-subtitle mono">{job.id}</div>
        </div>
        <div className="row" style={{ flex: 'none', gap: 8 }}>
          {['failed', 'dead_letter', 'cancelled'].includes(job.status) && (
            <button className="btn btn-primary" onClick={retry}>Retry job</button>
          )}
          {['queued', 'scheduled', 'retrying'].includes(job.status) && (
            <button className="btn" style={{ color: 'var(--danger)' }} onClick={cancel}>Cancel job</button>
          )}
        </div>
      </div>

      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
        <div className="metric-card">
          <div style={{ marginBottom: 2 }}><JobStatusBadge status={job.status} /></div>
          <div className="metric-label">Status</div>
        </div>
        <div className="metric-card">
          <div className="metric-value" style={{ fontSize: 18 }}>{job.attempt_count} / {job.max_attempts}</div>
          <div className="metric-label">Attempts</div>
        </div>
        <div className="metric-card">
          <div className="metric-value" style={{ fontSize: 18 }}>{job.priority}</div>
          <div className="metric-label">Priority</div>
        </div>
        <div className="metric-card">
          <div className="metric-value mono" style={{ fontSize: 13 }}>{relativeTime(job.run_at)}</div>
          <div className="metric-label">Run at</div>
        </div>
      </div>

      {job.error && (
        <div className="panel" style={{ borderColor: 'var(--danger)', marginBottom: 24 }}>
          <div className="section-heading" style={{ marginTop: 0, color: 'var(--danger)' }}>Last error</div>
          <div className="mono" style={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{job.error}</div>
        </div>
      )}

      {job.result && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <div className="section-heading" style={{ marginTop: 0 }}>Result</div>
          <pre className="mono" style={{ fontSize: 12.5, margin: 0, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(job.result, null, 2)}
          </pre>
        </div>
      )}

      <div className="section-heading">Payload</div>
      <div className="panel" style={{ marginBottom: 8 }}>
        <pre className="mono" style={{ fontSize: 12.5, margin: 0, whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(job.payload, null, 2)}
        </pre>
      </div>

      <div className="section-heading">Attempt history</div>
      {(job.executions ?? []).length === 0 ? (
        <div className="empty-state">No attempts yet.</div>
      ) : (
        <div className="panel" style={{ padding: 0, marginBottom: 8 }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Status</th>
                <th>Worker</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {job.executions!.map((ex) => (
                <tr key={ex.id}>
                  <td className="mono">{ex.attempt_number}</td>
                  <td>{ex.status}</td>
                  <td className="mono text-secondary">{ex.worker_id?.slice(0, 8) ?? '—'}</td>
                  <td className="text-secondary">{relativeTime(ex.started_at)}</td>
                  <td className="mono">{ex.duration_ms != null ? `${ex.duration_ms}ms` : '—'}</td>
                  <td className="text-secondary" style={{ maxWidth: 240 }}>{ex.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section-heading">Execution logs</div>
      <div className="panel mono" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
        {(job.logs ?? []).length === 0 ? (
          <span className="text-secondary">No logs yet.</span>
        ) : (
          job.logs!.map((l) => (
            <div key={l.id} style={{ color: l.level === 'error' ? 'var(--danger)' : l.level === 'warn' ? 'var(--accent)' : 'var(--text-primary)' }}>
              <span className="text-faint">{new Date(l.created_at).toLocaleTimeString()}</span>{'  '}
              <span className="text-faint">[{l.level}]</span>{'  '}
              {l.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
