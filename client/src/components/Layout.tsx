import { NavLink } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '../AuthContext';

/* Simple inline SVG icons — no external icon library needed */
function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function IconQueue() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}
function IconWorkers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>
    </svg>
  );
}
function IconSkull() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>
      <path d="M8 20v2h8v-2"/><path d="M12.5 17v3"/><path d="M12 4a8 8 0 0 0-8 8v4h4v2h8v-2h4v-4a8 8 0 0 0-8-8z"/>
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        {/* Logo mark */}
        <div className="brand">
          <div className="brand-mark" />
        </div>

        <NavLink to="/" end data-label="Overview"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <IconGrid />
        </NavLink>

        <NavLink to="/queues" data-label="Queues"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <IconQueue />
        </NavLink>

        <NavLink to="/workers" data-label="Workers"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <IconWorkers />
        </NavLink>

        <NavLink to="/dead-letter" data-label="Dead Letter"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <IconSkull />
        </NavLink>

        <div className="sidebar-footer">
          <button
            onClick={logout}
            data-label="Sign out"
            className="nav-link"
            style={{ border: 'none', background: 'none', width: 44, height: 44 }}
          >
            <IconLogout />
          </button>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
