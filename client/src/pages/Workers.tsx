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
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Workers</h1>
          <div className="page-subtitle">All worker processes that have ever registered, across every project</div>
        </div>
      </div>

      {workers.length === 0 ? (
        <div className="empty-state">
          No workers have registered yet. Start one with <code className="mono">npm run worker</code> in the server directory.
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
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
                    <SignalDot tone={tone(w)} />
                    {w.status === 'offline' ? 'Offline' : w.is_stale ? 'Unresponsive' : w.status === 'draining' ? 'Draining' : 'Online'}
                  </td>
                  <td className="text-secondary mono">{w.hostname}</td>
                  <td className="mono">{w.active_job_count} / {w.concurrency}</td>
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
