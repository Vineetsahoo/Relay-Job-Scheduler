import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useProjects } from '../ProjectContext';
import { Queue } from '../api/types';
import { ProjectSwitcher } from '../components/ProjectSwitcher';
import { Modal } from '../components/Modal';

export function QueuesPage() {
  const { activeProject } = useProjects();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    if (!activeProject) return;
    const res = await api.get(`/api/queues?project_id=${activeProject.id}`);
    setQueues(res.data);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject]);

  async function togglePause(q: Queue) {
    await api.patch(`/api/queues/${q.id}`, { is_paused: !q.is_paused });
    load();
  }

  return (
    <div className="fade-in">
      <div className="topbar">
        <div>
          <div className="page-greeting">Manage your job queues</div>
          <h1 className="page-title">Queues</h1>
          <div className="page-subtitle">{activeProject ? activeProject.name : 'Select a project'}</div>
        </div>
        <div className="row" style={{ flex: 'none', gap: 8 }}>
          <ProjectSwitcher />
          {activeProject && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New queue
            </button>
          )}
        </div>
      </div>

      {queues.length === 0 ? (
        <div className="empty-state">No queues yet. Create one to start submitting jobs.</div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Queue</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Concurrency</th>
                <th>Retry strategy</th>
                <th>Queued</th>
                <th>Running</th>
                <th>Completed</th>
                <th>Dead letter</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {queues.map((q) => (
                <tr key={q.id} className="clickable">
                  <td>
                    <Link to={`/queues/${q.id}`} style={{ fontWeight: 700 }}>{q.name}</Link>
                  </td>
                  <td>
                    <span className={`tag ${q.is_paused ? 'tag-neutral' : 'tag-green'}`}>
                      {q.is_paused ? 'Paused' : 'Active'}
                    </span>
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>{q.priority}</td>
                  <td className="mono">{q.concurrency_limit}</td>
                  <td>
                    <span className="tag tag-purple">{q.strategy ?? 'fixed'}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{q.queued_count ?? 0}</td>
                  <td style={{ color: 'var(--info)', fontWeight: 600 }}>{q.running_count ?? 0}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{q.completed_count ?? 0}</td>
                  <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{q.dead_letter_count ?? 0}</td>
                  <td>
                    <button className="btn btn-sm" onClick={(e) => { e.preventDefault(); togglePause(q); }}>
                      {q.is_paused ? 'Resume' : 'Pause'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && activeProject && (
        <CreateQueueModal projectId={activeProject.id} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </div>
  );
}

function CreateQueueModal({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [priority, setPriority] = useState(0);
  const [concurrency, setConcurrency] = useState(5);
  const [strategy, setStrategy] = useState<'fixed' | 'linear' | 'exponential'>('exponential');
  const [baseDelay, setBaseDelay] = useState(30);
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/api/queues', {
        project_id: projectId,
        name,
        priority,
        concurrency_limit: concurrency,
        retry_policy: {
          strategy,
          base_delay_seconds: baseDelay,
          max_delay_seconds: 3600,
          max_attempts: maxAttempts,
        },
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
    <Modal title="New queue" onClose={onClose}>
      <div className="field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="emails" />
      </div>
      <div className="row">
        <div className="field">
          <label>Priority (higher runs first)</label>
          <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Concurrency limit</label>
          <input type="number" min={1} value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} />
        </div>
      </div>

      <div className="section-heading" style={{ margin: '4px 0 12px' }}>Retry policy</div>
      <div className="field">
        <label>Strategy</label>
        <select value={strategy} onChange={(e) => setStrategy(e.target.value as any)}>
          <option value="fixed">Fixed delay</option>
          <option value="linear">Linear backoff</option>
          <option value="exponential">Exponential backoff</option>
        </select>
      </div>
      <div className="row">
        <div className="field">
          <label>Base delay (seconds)</label>
          <input type="number" min={1} value={baseDelay} onChange={(e) => setBaseDelay(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Max attempts</label>
          <input type="number" min={0} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} />
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="row spacer-top">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={!name || submitting}>
          {submitting ? 'Creating…' : 'Create queue'}
        </button>
      </div>
    </Modal>
  );
}
