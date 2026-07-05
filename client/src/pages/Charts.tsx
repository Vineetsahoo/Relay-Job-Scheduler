import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useProjects } from '../ProjectContext';
import { ThroughputChart } from '../components/ThroughputChart';
import { ProjectSwitcher } from '../components/ProjectSwitcher';

export function ChartsPage() {
  const { activeProject } = useProjects();
  const [throughput24, setThroughput24] = useState<any[]>([]);
  const [throughput7d, setThroughput7d] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [window, setWindow] = useState<'24h' | '7d' | '30d'>('24h');

  useEffect(() => {
    if (!activeProject) return;
    async function load() {
      setLoading(true);
      try {
        const [t24, t7d] = await Promise.all([
          api.get(`/api/dashboard/throughput?project_id=${activeProject!.id}&hours=24`),
          api.get(`/api/dashboard/throughput?project_id=${activeProject!.id}&hours=168`),
        ]);
        setThroughput24(t24.data);
        setThroughput7d(t7d.data);
      } finally {
        setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [activeProject]);

  const activeData = window === '24h' ? throughput24 : throughput7d;
  const totalCompleted = activeData.reduce((a: number, d: any) => a + (d.completed ?? 0), 0);
  const totalFailed    = activeData.reduce((a: number, d: any) => a + (d.failed ?? 0), 0);
  const successRate    = totalCompleted + totalFailed > 0
    ? Math.round((totalCompleted / (totalCompleted + totalFailed)) * 100) : 0;

  return (
    <div className="fade-in">
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="page-greeting">Visual analytics for your job system</div>
          <h1 className="page-title">Charts &amp; Analytics</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <ProjectSwitcher />
        </div>
      </div>

      {!activeProject ? (
        <div className="panel" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>📊</div>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>No project selected</div>
          <div className="text-secondary" style={{ marginBottom: 22 }}>Select a project to view charts</div>
          <ProjectSwitcher />
        </div>
      ) : (
        <>
          {/* ── Summary stat cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Completed', value: totalCompleted.toLocaleString(), color: 'var(--success)', bg: 'rgba(32,201,151,0.12)' },
              { label: 'Total Failed',    value: totalFailed.toLocaleString(),    color: 'var(--danger)',  bg: 'rgba(248,113,113,0.12)' },
              { label: 'Success Rate',    value: `${successRate}%`,               color: '#c471f5',        bg: 'rgba(155,89,245,0.12)' },
              { label: 'Data Points',     value: activeData.length,               color: 'var(--info)',    bg: 'rgba(96,165,250,0.12)' },
            ].map(c => (
              <div key={c.label} className="metric-card fade-in" style={{ border: `1px solid ${c.bg}` }}>
                <div className="metric-value" style={{ color: c.color, fontSize: 26 }}>{c.value}</div>
                <div className="metric-label">{c.label}</div>
              </div>
            ))}
          </div>

          {/* ── Main chart ── */}
          <div className="panel fade-in-1" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Job Throughput — {window === '24h' ? 'Last 24 hours' : 'Last 7 days'}
                </div>
                <div className="panel-underline" style={{ marginTop: 5 }} />
              </div>
              {/* Time window selector */}
              <div className="pill-toggle">
                {(['24h', '7d'] as const).map(w => (
                  <button
                    key={w}
                    className={window === w ? 'active' : ''}
                    onClick={() => setWindow(w)}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            {loading && activeData.length === 0 ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>
                Loading…
              </div>
            ) : (
              <ThroughputChart data={activeData} />
            )}
          </div>

          {/* ── Two side-by-side smaller charts ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="panel fade-in-2">
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Completed jobs</div>
              <div className="panel-underline" style={{ marginBottom: 14 }} />
              <ThroughputChart data={activeData.map((d: any) => ({ ...d, failed: 0 }))} />
            </div>
            <div className="panel fade-in-3">
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Failed jobs</div>
              <div className="panel-underline" style={{ marginBottom: 14 }} />
              <ThroughputChart data={activeData.map((d: any) => ({ ...d, completed: 0 }))} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
