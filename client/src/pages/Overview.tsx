import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useProjects } from '../ProjectContext';
import { ThroughputChart } from '../components/ThroughputChart';
import { ProjectSwitcher } from '../components/ProjectSwitcher';

export function OverviewPage() {
  const { activeProject } = useProjects();
  const [summary, setSummary] = useState<any>(null);
  const [throughput, setThroughput] = useState<any[]>([]);

  useEffect(() => {
    if (!activeProject) return;
    async function load() {
      const [summaryRes, throughputRes] = await Promise.all([
        api.get(`/api/dashboard/summary?project_id=${activeProject!.id}`),
        api.get(`/api/dashboard/throughput?project_id=${activeProject!.id}&hours=24`),
      ]);
      setSummary(summaryRes);
      setThroughput(throughputRes.data);
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [activeProject]);

  const statusCount = (status: string) =>
    summary?.jobs_by_status.find((s: any) => s.status === status)?.count ?? 0;

  if (!activeProject) {
    return (
      <div>
        <div className="topbar">
          <div>
            <h1 className="page-title">Overview</h1>
            <p className="page-subtitle">Create a project to get started</p>
          </div>
          <ProjectSwitcher />
        </div>
        <div className="empty-state">
          No project selected. Use the project switcher above to create or select one.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Top bar ── */}
      <div className="topbar">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">{activeProject.name}</p>
        </div>
        <ProjectSwitcher />
      </div>

      {/* ── Metric cards ── */}
      <div className="card-grid">
        <div className="metric-card card-yellow">
          <div className="metric-value">{summary?.active_worker_count ?? '—'}</div>
          <div className="metric-label">Active workers</div>
        </div>

        <div className="metric-card card-purple">
          <div className="metric-value">{summary?.queue_count ?? '—'}</div>
          <div className="metric-label">Queues</div>
        </div>

        <div className="metric-card card-blue">
          <div className="metric-value">
            {statusCount('queued') + statusCount('retrying') + statusCount('scheduled')}
          </div>
          <div className="metric-label">Pending jobs</div>
        </div>

        <div className="metric-card card-green">
          <div className="metric-value">
            {statusCount('running') + statusCount('claimed')}
          </div>
          <div className="metric-label">Running now</div>
        </div>

        <div className="metric-card card-dark">
          <div className="metric-value" style={{ color: '#FF6B6B' }}>
            {statusCount('dead_letter')}
          </div>
          <div className="metric-label">Dead letter</div>
        </div>

        <div className="metric-card">
          <div className="metric-value" style={{ color: 'var(--success)' }}>
            {statusCount('completed')}
          </div>
          <div className="metric-label">Completed</div>
        </div>
      </div>

      {/* ── Throughput chart ── */}
      <div className="section-heading">Throughput — last 24 hours</div>
      <div className="panel">
        <ThroughputChart data={throughput} />
        <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 12.5, fontWeight: 600 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--success)', display: 'inline-block' }} />
            Completed
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--danger)', display: 'inline-block' }} />
            Failed
          </span>
        </div>
      </div>
    </div>
  );
}
