import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Worker } from '../api/types';
import { SignalDot, relativeTime } from '../components/StatusUI';

/** Mini SVG sparkline from heartbeat data */
function Sparkline({ workerId }: { workerId: string }) {
  const [points, setPoints] = useState<number[]>([]);

  useEffect(() => {
    api.get(`/api/workers/${workerId}/heartbeats`).then((res) => {
      setPoints(res.data.map((h: any) => h.active_jobs as number));
    }).catch(() => {});
  }, [workerId]);

  if (points.length < 2) return <span className="text-secondary" style={{ fontSize: 11 }}>—</span>;

  const W = 64, H = 24;
  const max = Math.max(...points, 1);
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - (v / max) * H;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <polyline points={coords} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
    </svg>
  );
}

export function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);

  async function load() {
    const res = await api.get('/api/workers');
    setWorkers(res.data);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, []);

  function tone(w: Worker): 'success' | 'danger' | 'neutral' | 'accent' {
    if (w.status === 'offline') return 'neutral';
    if (w.is_stale) return 'danger';
    if (w.status === 'draining') return 'accent';
    return 'success';
  }

  return (
    <div className="fade-in">
      <div className="topbar">
        <div>
          <div className="page-greeting">Monitor your compute layer</div>
          <h1 className="page-title">Workers</h1>
          <div className="page-subtitle">All worker processes that have ever registered, across every project</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 'var(--radius-pill)',
            background: 'var(--success-dim)', border: '1px solid rgba(34,211,165,0.2)',
          }}>
            <span className="dot dot-success" style={{ margin: 0 }}/>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>
              {workers.filter(w => w.status !== 'offline' && !w.is_stale).length} online
            </span>
          </div>
        </div>
      </div>

      {workers.length === 0 ? (
        <div className="empty-state">
          No workers have registered yet. Start one with <code className="mono">npm run worker</code> in the server directory.
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Status</th>
                <th>Host</th>
                <th>Load</th>
                <th>Activity</th>
                <th>Started</th>
                <th>Last heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id}>
                  <td className="mono" style={{ fontWeight: 600 }}>{w.name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <SignalDot tone={tone(w)} />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {w.status === 'offline' ? 'Offline' : w.is_stale ? 'Unresponsive' : w.status === 'draining' ? 'Draining' : 'Online'}
                      </span>
                    </div>
                  </td>
                  <td className="text-secondary mono" style={{ fontSize: 12.5 }}>{w.hostname}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="mono" style={{ fontWeight: 600 }}>{w.active_job_count}/{w.concurrency}</span>
                      <div style={{ flex: 1, maxWidth: 50 }}>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${(w.active_job_count / Math.max(w.concurrency, 1)) * 100}%` }}/>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td><Sparkline workerId={w.id} /></td>
                  <td className="text-secondary">{relativeTime(w.started_at)}</td>
                  <td className="text-secondary">{relativeTime(w.last_heartbeat_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
