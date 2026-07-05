import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useProjects } from '../ProjectContext';

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { activeProject, projects, organizations } = useProjects();
  const [copied, setCopied] = useState(false);

  function copyApiKey() {
    if (!activeProject?.api_key) return;
    navigator.clipboard.writeText(activeProject.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fade-in">
      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div className="page-greeting">Manage your account and project configuration</div>
        <h1 className="page-title">Settings</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Profile card ── */}
        <div className="panel fade-in">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Account
          </div>
          <div className="panel-underline" style={{ marginBottom: 20 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
            <div className="avatar" style={{ width: 52, height: 52, fontSize: 20, flexShrink: 0 }}>
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{user?.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{user?.email}</div>
            </div>
          </div>

          <div className="field">
            <label>Display name</label>
            <input defaultValue={user?.name ?? ''} placeholder="Your name" readOnly style={{ opacity: 0.7 }} />
          </div>
          <div className="field">
            <label>Email address</label>
            <input defaultValue={user?.email ?? ''} type="email" placeholder="you@example.com" readOnly style={{ opacity: 0.7 }} />
          </div>

          <button
            className="btn btn-danger btn-sm"
            onClick={logout}
            style={{ marginTop: 8, gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>

        {/* ── Active project card ── */}
        <div className="panel fade-in-1">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Active Project
          </div>
          <div className="panel-underline" style={{ marginBottom: 20 }} />

          {activeProject ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: 'var(--grad-brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, color: 'white',
                }}>
                  {activeProject.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{activeProject.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 1 }}>
                    ID: <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{activeProject.id.slice(0, 16)}…</span>
                  </div>
                </div>
              </div>

              <div className="field">
                <label>API Key</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    readOnly
                    value={activeProject.api_key}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12, opacity: 0.8 }}
                  />
                  <button className="btn btn-sm" onClick={copyApiKey} style={{ flexShrink: 0, gap: 5 }}>
                    {copied ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Created</label>
                <input
                  readOnly
                  value={new Date(activeProject.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  style={{ opacity: 0.7 }}
                />
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              No project selected
            </div>
          )}
        </div>

        {/* ── Organizations card ── */}
        <div className="panel fade-in-2">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Organizations
          </div>
          <div className="panel-underline" style={{ marginBottom: 16 }} />
          {organizations.length === 0 ? (
            <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>No organizations found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {organizations.map(org => (
                <div key={org.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 'var(--r)',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: 'var(--grad-brand)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, color: 'white',
                  }}>
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{org.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>Role: {org.role}</div>
                  </div>
                  <span className="tag tag-purple" style={{ fontSize: 10.5, flexShrink: 0 }}>{org.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── All projects card ── */}
        <div className="panel fade-in-3">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            All Projects
          </div>
          <div className="panel-underline" style={{ marginBottom: 16 }} />
          {projects.length === 0 ? (
            <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>No projects found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {projects.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 'var(--r)',
                  background: p.id === activeProject?.id ? 'rgba(155,89,245,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${p.id === activeProject?.id ? 'rgba(155,89,245,0.25)' : 'var(--border)'}`,
                  transition: 'all 0.15s',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: p.id === activeProject?.id ? '#c471f5' : 'var(--text-faint)',
                    boxShadow: p.id === activeProject?.id ? '0 0 8px rgba(196,113,245,0.6)' : 'none',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                      {p.id.slice(0, 20)}…
                    </div>
                  </div>
                  {p.id === activeProject?.id && (
                    <span className="tag tag-purple" style={{ fontSize: 10, flexShrink: 0 }}>active</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
