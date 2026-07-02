import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useProjects } from '../ProjectContext';
import { Queue, DeadLetterEntry } from '../api/types';
import { relativeTime } from '../components/StatusUI';
import { ProjectSwitcher } from '../components/ProjectSwitcher';

export function DeadLetterPage() {
  const { activeProject } = useProjects();
  const navigate = useNavigate();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [queueId, setQueueId] = useState<string>('');
  const [entries, setEntries] = useState<DeadLetterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);

  // Load queues when project changes
  useEffect(() => {
    if (!activeProject) return;
    api.get(`/api/queues?project_id=${activeProject.id}`).then((res) => {
      setQueues(res.data);
      if (res.data.length > 0) setQueueId(res.data[0].id);
    });
  }, [activeProject]);

  async function load() {
    if (!queueId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/dead-letter?queue_id=${queueId}`);
      setEntries(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueId]);

  async function retryEntry(entry: DeadLetterEntry) {
    await api.post(`/api/jobs/${entry.original_job_id}/retry`);
    // Optimistic remove — the server deletes the DLQ entry on retry
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
  }

  async function discardEntry(entryId: string) {
    await api.del(`/api/dead-letter/${entryId}`);
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  }

  async function purgeAll() {
    if (!queueId) return;
    if (!confirm(`Permanently delete all ${entries.length} dead letter entries for this queue? This cannot be undone.`)) return;
    setPurging(true);
    try {
      await api.del(`/api/dead-letter?queue_id=${queueId}`);
      setEntries([]);
    } finally {
      setPurging(false);
    }
  }

  const selectedQueue = queues.find((q) => q.id === queueId);

  return (
    <div>
      {/* ── Top bar ── */}
      <div className="topbar">
        <div>
          <h1 className="page-title">Dead Letter Queue</h1>
          <p className="page-subtitle">
            Jobs that failed every retry attempt and need manual intervention
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ProjectSwitcher />
          {queues.length > 0 && (
            <select
              value={queueId}
              onChange={(e) => setQueueId(e.target.value)}
              style={{ width: 180, borderRadius: 'var(--radius-pill)', fontWeight: 600 }}
            >
              {queues.map((q) => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Explainer banner ── */}
      <div className="panel" style={{ marginBottom: 24, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 'var(--radius)', background: 'var(--danger-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="7" r="3"/><path d="M8 14v2h8v-2"/><path d="M12.5 11v3"/>
            <path d="M12 4a8 8 0 0 0-8 8v4h4v2h8v-2h4v-4a8 8 0 0 0-8-8z"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>How the Dead Letter Queue works</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
            When a job fails and has no retry attempts left, the worker moves it here instead of discarding it.
            Each entry preserves the original job's payload and the exact error that caused the final failure.
            You can <strong>Retry</strong> an entry to re-queue the original job with a fresh attempt count,
            or <strong>Discard</strong> it if you don't want to run it again.
            {selectedQueue && selectedQueue.max_attempts !== undefined && (
              <span> Jobs in <strong>{selectedQueue.name}</strong> exhaust retries after <strong>{selectedQueue.max_attempts} attempt{selectedQueue.max_attempts !== 1 ? 's' : ''}</strong>.</span>
            )}
          </div>
        </div>
      </div>

      {/* ── How to trigger DLQ (demo tip) ── */}
      <div className="panel" style={{ marginBottom: 24, background: 'var(--warning-dim)', boxShadow: 'none' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 18 }}>💡</span>
          <div style={{ fontSize: 13, color: 'var(--warning-text)', fontWeight: 500, lineHeight: 1.5 }}>
            <strong>To test this:</strong> Create a job with type <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: 4 }}>fail_randomly</code> and payload{' '}
            <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: 4 }}>{`{"fail_rate": 1}`}</code>.
            Make sure your queue has a retry policy with a low <strong>max attempts</strong> (e.g. 2) and a short <strong>base delay</strong> (e.g. 5s).
            After the worker exhausts retries, the job appears here.
          </div>
        </div>
      </div>

      {/* ── Stats bar ── */}
      {entries.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            <span style={{ color: 'var(--danger)', marginRight: 6 }}>●</span>
            {entries.length} permanently failed job{entries.length !== 1 ? 's' : ''}
          </div>
          <button
            className="btn btn-sm btn-danger"
            onClick={purgeAll}
            disabled={purging}
          >
            {purging ? 'Purging…' : `Purge all (${entries.length})`}
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && entries.length === 0 && (
        <div className="panel">
          <div className="empty-state" style={{ padding: '32px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Nothing here</div>
            <div className="text-secondary">No jobs have permanently failed for this queue.</div>
          </div>
        </div>
      )}

      {/* ── Entries table ── */}
      {entries.length > 0 && (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Job type</th>
                <th>Attempts made</th>
                <th>Last error</th>
                <th>Moved to DLQ</th>
                <th>Current status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const wasRetried = e.current_job_status && !['dead_letter', 'failed'].includes(e.current_job_status);
                return (
                  <tr key={e.id}>
                    {/* Job type — clickable to job detail */}
                    <td>
                      <button
                        className="btn-ghost btn btn-sm"
                        style={{ fontFamily: 'var(--font-mono)', padding: '2px 6px', fontWeight: 700 }}
                        onClick={() => navigate(`/jobs/${e.original_job_id}`)}
                      >
                        {e.type}
                      </button>
                    </td>

                    {/* Attempt count */}
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                        background: 'var(--danger-dim)', color: 'var(--danger-text)',
                        fontWeight: 700, fontSize: 12,
                      }}>
                        {e.attempt_count} attempt{e.attempt_count !== 1 ? 's' : ''}
                      </span>
                    </td>

                    {/* Error message — truncated */}
                    <td style={{ maxWidth: 300 }}>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--danger)',
                        background: 'var(--danger-dim)', padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        maxWidth: 280,
                      }} title={e.last_error}>
                        {e.last_error}
                      </div>
                    </td>

                    {/* Time */}
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {relativeTime(e.moved_at)}
                    </td>

                    {/* Current job status */}
                    <td>
                      {wasRetried ? (
                        <span style={{
                          padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                          background: 'var(--success-dim)', color: 'var(--success-text)',
                          fontWeight: 700, fontSize: 12,
                        }}>
                          Retried → {e.current_job_status}
                        </span>
                      ) : (
                        <span style={{
                          padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                          background: 'var(--danger-dim)', color: 'var(--danger-text)',
                          fontWeight: 700, fontSize: 12,
                        }}>
                          dead letter
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {!wasRetried && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => retryEntry(e)}
                          >
                            ↩ Retry
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => discardEntry(e.id)}
                        >
                          Discard
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
