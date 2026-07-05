import { useEffect, useState, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useProjects } from '../ProjectContext';
import { ThroughputChart } from '../components/ThroughputChart';
import { ProjectSwitcher } from '../components/ProjectSwitcher';
import { useAuth } from '../AuthContext';

/* ─── helpers ─── */
function sc(summary: any, status: string): number {
  return summary?.jobs_by_status?.find((x: any) => x.status === status)?.count ?? 0;
}

/* ─── sub-components ─── */

function MCard({ label, value, sub, variant = '', icon, iconBg, valueColor, children, delay = 0 }: {
  label: string; value: any; sub?: string; variant?: string;
  icon?: ReactNode; iconBg?: string; valueColor?: string;
  children?: ReactNode; delay?: number;
}) {
  return (
    <div
      className={`metric-card fade-in ${variant}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
        <div style={{ minWidth:0 }}>
          <div className="metric-value" style={valueColor ? { color: valueColor } : {}}>{value}</div>
          <div className="metric-label">{label}</div>
          {sub && <div style={{ fontSize:11, color:'var(--text-faint)', marginTop:3 }}>{sub}</div>}
        </div>
        {icon && (
          <div className="metric-icon-box" style={{ background: iconBg }}>
            {icon}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/* ─── period breakdown pill ─── */
function PeriodBar({ summary }: { summary: any }) {
  const workers = summary?.active_worker_count ?? 0;
  const pending = (sc(summary,'queued') + sc(summary,'scheduled') + sc(summary,'retrying'));
  const running = sc(summary,'running') + sc(summary,'claimed');

  return (
    <div className="panel fade-in-1" style={{ position:'relative' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:18 }}>
        <div>
          <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text-primary)' }}>Job Period Breakdown</div>
          <div className="panel-underline" style={{ marginTop:6 }} />
        </div>
        <div style={{ display:'flex', gap:28, alignItems:'flex-start' }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.03em', color:'var(--text-primary)', lineHeight:1.1 }}>
              {workers}
            </div>
            <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>Active workers</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.03em', color:'var(--text-primary)', lineHeight:1.1 }}>
              {running + pending}
            </div>
            <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>Jobs in flight</div>
          </div>
        </div>
      </div>

      {/* "Today" label */}
      <div style={{ position:'relative', marginBottom:20 }}>
        <div style={{
          position:'absolute', top:-17, left:'38%',
          transform:'translateX(-50%)',
          fontSize:10.5, color:'var(--text-secondary)', fontWeight:500,
          letterSpacing:'0.04em',
        }}>
          Today
        </div>

        {/* The pill progress bar — exact image match */}
        <div style={{
          height:38,
          borderRadius:100,
          background:'rgba(255,255,255,0.03)',
          border:'1px solid rgba(255,255,255,0.07)',
          display:'flex', alignItems:'stretch',
          overflow:'hidden',
          position:'relative',
        }}>
          {/* Left filled section — purple gradient pill */}
          <div style={{
            width:'40%',
            background:'linear-gradient(90deg, #7c3aed 0%, #c471f5 70%, #e040a0 100%)',
            display:'flex', alignItems:'center',
            paddingLeft:14, gap:7, flexShrink:0,
          }}>
            <div style={{ width:9, height:9, borderRadius:'50%', background:'rgba(255,255,255,0.9)', boxShadow:'0 0 8px rgba(255,255,255,0.5)' }}/>
            <span style={{ fontSize:12, fontWeight:700, color:'white', letterSpacing:'-0.01em' }}>Queued</span>
          </div>

          {/* Center — "Processing" tag */}
          <div style={{
            flex:1, display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(255,255,255,0.015)',
          }}>
            <span style={{ fontSize:11.5, color:'var(--text-muted)', fontWeight:500 }}>Processing</span>
          </div>

          {/* Right — "Done" bubble */}
          <div style={{
            width:'26%',
            display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            background:'rgba(255,255,255,0.04)',
            borderLeft:'1px solid rgba(255,255,255,0.06)',
            flexShrink:0,
          }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'rgba(255,255,255,0.35)' }}/>
            <span style={{ fontSize:11.5, color:'var(--text-secondary)', fontWeight:500 }}>Done</span>
          </div>

          {/* Rightmost dashed / pending section */}
          <div style={{
            width:'16%',
            background:'repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 8px)',
            borderLeft:'1px dashed rgba(255,255,255,0.08)',
            flexShrink:0,
          }}/>
        </div>
      </div>

      {/* Axis labels */}
      <div style={{ display:'flex', justifyContent:'space-between', paddingRight:'16%', fontSize:11, color:'var(--text-faint)', fontWeight:400 }}>
        <span>Pay Period</span>
        <span>Processing</span>
        <span>Payday</span>
      </div>
    </div>
  );
}

/* ─── Recent Activity right panel ─── */
function RecentPanel({ summary }: { summary: any }) {
  const [tab, setTab] = useState<'payroll'|'employee'|'attendance'|'retirement'>('payroll');
  const statuses: Array<{ status: string; count: number }> = summary?.jobs_by_status ?? [];

  const TABS = [
    { key:'payroll', label:'Recent Payroll' },
    { key:'employee', label:'Employee' },
    { key:'attendance', label:'Attendance' },
    { key:'retirement', label:'Retirement' },
  ] as const;

  return (
    <div className="panel fade-in-2" style={{
      display:'flex', flexDirection:'column', height:'100%', minHeight:340,
    }}>
      {/* Tab row */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding:'5px 12px',
              borderRadius:100,
              border: tab===t.key ? 'none' : '1px solid var(--border)',
              background: tab===t.key ? 'var(--text-primary)' : 'transparent',
              color: tab===t.key ? 'var(--bg-base)' : 'var(--text-secondary)',
              fontWeight: tab===t.key ? 700 : 400,
              fontSize:12.5, cursor:'pointer',
              transition:'all 0.18s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search + sort row */}
      <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center' }}>
        <div style={{
          flex:1, display:'flex', alignItems:'center', gap:7,
          background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)',
          borderRadius:100, padding:'6px 12px', fontSize:12.5, color:'var(--text-muted)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            style={{
              background:'none', border:'none', outline:'none', padding:0, width:'100%',
              color:'var(--text-primary)', fontSize:12.5,
            }}
            placeholder="Search by name…"
          />
        </div>
        <div style={{
          display:'flex', alignItems:'center', gap:4, padding:'6px 10px',
          background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)',
          borderRadius:6, fontSize:12, color:'var(--text-secondary)', cursor:'pointer',
          flexShrink:0,
        }}>
          Sort by
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 100px 80px',
        gap:8, paddingBottom:8, marginBottom:4,
        borderBottom:'1px solid var(--border-soft)',
        fontSize:10,
      }}>
        {['Job Type','Count','Status'].map(h => (
          <span key={h} style={{ fontSize:10, fontWeight:600, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:2, overflowY:'auto' }}>
        {statuses.length === 0 ? (
          <div style={{ padding:'24px 0', textAlign:'center', color:'var(--text-faint)', fontSize:13 }}>
            No job data yet
          </div>
        ) : statuses.map((s, i) => (
          <div
            key={s.status}
            style={{
              display:'grid', gridTemplateColumns:'1fr 100px 80px',
              gap:8, padding:'9px 0',
              borderBottom:'1px solid var(--border-soft)',
              alignItems:'center',
              animation:`fade-up 0.25s ${i * 40}ms ease both`,
            }}
          >
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{
                width:28, height:28, borderRadius:'50%',
                background:`linear-gradient(135deg,${jobAvatarColor(s.status)[0]},${jobAvatarColor(s.status)[1]})`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, fontWeight:800, color:'white', flexShrink:0,
              }}>
                {s.status.slice(0,2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text-primary)', textTransform:'capitalize' }}>
                  {s.status.replace('_',' ')}
                </div>
                <div style={{ fontSize:10.5, color:'var(--text-faint)' }}>job type</div>
              </div>
            </div>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>
              {s.count.toLocaleString()}
            </span>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:4,
              padding:'3px 9px', borderRadius:100,
              background: statusDim(s.status), color: statusClr(s.status),
              fontSize:11, fontWeight:700,
            }}>
              <svg width="7" height="7" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="currentColor"/></svg>
              {statusLabel(s.status)}
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--border-soft)' }}>
        <div style={{ fontSize:16, fontWeight:800, letterSpacing:'-0.03em', color:'var(--text-primary)', marginBottom:8 }}>
          Get All<br/>Data Here
        </div>
        <Link to="/queues" className="btn btn-sm btn-primary" style={{ textDecoration:'none' }}>
          See More
        </Link>
      </div>
    </div>
  );
}

/* ─── Main page ─── */
export function OverviewPage() {
  const { activeProject } = useProjects();
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [throughput, setThroughput] = useState<any[]>([]);

  useEffect(() => {
    if (!activeProject) return;
    async function load() {
      const [s, t] = await Promise.all([
        api.get(`/api/dashboard/summary?project_id=${activeProject!.id}`),
        api.get(`/api/dashboard/throughput?project_id=${activeProject!.id}&hours=24`),
      ]);
      setSummary(s); setThroughput(t.data);
    }
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [activeProject]);

  const completed = sc(summary,'completed');
  const total = summary?.jobs_by_status?.reduce((a:number,x:any)=>a+x.count,0) ?? 0;
  const pct   = total ? Math.round((completed/total)*100) : 0;
  const name  = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div>
      {/* ── Page header ── */}
      <div className="fade-in" style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:22 }}>
        <div>
          <div className="page-greeting">Welcome back, {name} 🤌</div>
          <h1 className="page-title">
            Dashboard Overview
            {activeProject && (
              <span className="page-badge">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                {activeProject.name} · Private Access
              </span>
            )}
          </h1>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button className="ib">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </button>
          <ProjectSwitcher />
          <Link to="/queues" className="btn-create-report">
            Create a Report
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="7" y1="17" x2="17" y2="7"/>
              <polyline points="7 7 17 7 17 17"/>
            </svg>
          </Link>
        </div>
      </div>

      {!activeProject ? (
        <div className="panel fade-in" style={{ textAlign:'center', padding:'60px 24px' }}>
          <div style={{ fontSize:36, marginBottom:14 }}>🚀</div>
          <div style={{ fontWeight:700, fontSize:17, marginBottom:8 }}>No project selected</div>
          <div className="text-secondary" style={{ marginBottom:22 }}>Create or select a project to view your dashboard</div>
          <ProjectSwitcher />
        </div>
      ) : (
        <>
          {/* ── Row 1: Total Jobs + Period Breakdown ── */}
          <div style={{ display:'grid', gridTemplateColumns:'0.9fr 1.8fr', gap:14, marginBottom:14 }}>

            {/* Total Jobs card */}
            <div className="panel fade-in" style={{ display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
                <span style={{ fontSize:13.5, fontWeight:600, color:'var(--text-primary)' }}>Total Jobs Processed</span>
                <span className="tag tag-blue" style={{ fontSize:10.5 }}>Next</span>
              </div>

              <div>
                <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:5 }}>
                  <span style={{ fontSize:38, fontWeight:900, letterSpacing:'-0.05em', lineHeight:1, color:'var(--text-primary)' }}>
                    {total >= 1000 ? `${(total/1000).toFixed(1)}K` : total || '0'}
                  </span>
                  {pct > 0 && (
                    <span className="metric-delta">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><polyline points="18 15 12 9 6 15"/></svg>
                      {pct}%
                    </span>
                  )}
                </div>
                <div style={{ fontSize:12, color:'var(--text-secondary)' }}>
                  This month · {summary?.queue_count ?? 0} queues
                </div>
              </div>

              <div style={{ marginTop:16 }}>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width:`${pct}%` }} />
                </div>
                <div style={{ fontSize:10.5, color:'var(--text-faint)', marginTop:4 }}>{pct}% success rate</div>
              </div>
            </div>

            {/* Period breakdown */}
            <PeriodBar summary={summary} />
          </div>

          {/* ── Row 2: Chart (left) + Recent Activity (right) ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:14, marginBottom:14 }}>

            {/* Chart panel */}
            <div className="panel fade-in-2" style={{ position:'relative' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text-primary)' }}>
                    Job Throughput Breakdown
                  </div>
                  <div className="panel-underline" style={{ marginTop:5 }} />
                </div>
                <div style={{ display:'flex', gap:7 }}>
                  <button className="ib" title="Download">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </button>
                  <button className="ib" title="Expand">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="7" y1="17" x2="17" y2="7"/>
                      <polyline points="7 7 17 7 17 17"/>
                    </svg>
                  </button>
                </div>
              </div>
              <ThroughputChart data={throughput} />
            </div>

            {/* Recent Activity */}
            <RecentPanel summary={summary} />
          </div>

          {/* ── Row 3: metric cards ── */}
          <div className="card-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))' }}>
            <MCard
              label="Active Workers" value={summary?.active_worker_count ?? '—'}
              variant="mc-purple" delay={0}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c471f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="3"/>
                  <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              }
              iconBg="rgba(155,89,245,0.18)"
            />
            <MCard
              label="Queues" value={summary?.queue_count ?? '—'}
              variant="mc-teal" delay={50}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                </svg>
              }
              iconBg="rgba(32,201,151,0.15)"
            />
            <MCard
              label="Pending" value={sc(summary,'queued')+sc(summary,'retrying')+sc(summary,'scheduled')}
              variant="mc-blue" delay={100}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              }
              iconBg="rgba(96,165,250,0.15)"
            />
            <MCard
              label="Running" value={sc(summary,'running')+sc(summary,'claimed')}
              variant="mc-amber" delay={150}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              }
              iconBg="rgba(251,191,36,0.15)"
            />
            <MCard
              label="Dead Letter" value={sc(summary,'dead_letter')}
              variant="mc-red" delay={200}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              }
              iconBg="rgba(248,113,113,0.15)"
            />
            <MCard
              label="Completed" value={completed} valueColor="var(--success)" delay={250}
            >
              <div style={{ marginTop:10 }}>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width:`${pct}%` }} />
                </div>
                <div style={{ fontSize:10, color:'var(--text-faint)', marginTop:3 }}>{pct}% of total</div>
              </div>
            </MCard>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── colour helpers ─── */
function statusClr(s: string) {
  if (['completed'].includes(s))            return 'var(--success)';
  if (['running','claimed'].includes(s))    return 'var(--info)';
  if (['failed','dead_letter'].includes(s)) return 'var(--danger)';
  if (['queued','scheduled','retrying'].includes(s)) return '#c471f5';
  return 'var(--text-secondary)';
}
function statusDim(s: string) {
  if (['completed'].includes(s))            return 'rgba(32,201,151,0.13)';
  if (['running','claimed'].includes(s))    return 'rgba(96,165,250,0.13)';
  if (['failed','dead_letter'].includes(s)) return 'rgba(248,113,113,0.13)';
  if (['queued','scheduled','retrying'].includes(s)) return 'rgba(155,89,245,0.13)';
  return 'rgba(255,255,255,0.05)';
}
function statusLabel(s: string) {
  if (['completed'].includes(s)) return 'Paid';
  if (['running','claimed'].includes(s)) return 'Active';
  if (['failed','dead_letter'].includes(s)) return 'Failed';
  if (['queued','scheduled'].includes(s)) return 'Pending';
  if (['retrying'].includes(s)) return 'Retry';
  return s;
}
function jobAvatarColor(s: string): [string,string] {
  if (['completed'].includes(s)) return ['#059669','#10b981'];
  if (['failed','dead_letter'].includes(s)) return ['#dc2626','#f87171'];
  if (['running','claimed'].includes(s)) return ['#2563eb','#60a5fa'];
  return ['#7c3aed','#c471f5'];
}
