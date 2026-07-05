import { NavLink } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '../AuthContext';
import { RelayLogo } from './RelayLogo';

const NAV = [
  {
    to: '/', end: true, label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    to: '/queues', label: 'Queues',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <line x1="9" y1="6" x2="20" y2="6"/>
        <line x1="9" y1="12" x2="20" y2="12"/>
        <line x1="9" y1="18" x2="20" y2="18"/>
        <circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    to: '/workers', label: 'Workers',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="3"/>
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        <path d="M21 21v-2a4 4 0 0 0-3-3.85"/>
      </svg>
    ),
  },
  {
    to: '/dead-letter', label: 'Dead Letter',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
];

const SECONDARY_NAV = [
  {
    to: '/charts', label: 'Charts',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    to: '/settings', label: 'Settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    ),
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="shell">

      {/* ────────────────── SIDEBAR ────────────────── */}
      <aside className="sidebar">

        {/* Brand — custom Relay logo mark */}
        <NavLink to="/" className="tip" data-tip="Relay" style={{ marginBottom: 20, flexShrink: 0 }}>
          <RelayLogo size={38} />
        </NavLink>

        {/* Primary navigation */}
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `nav-btn tip${isActive ? ' active' : ''}`}
            data-tip={n.label}
          >
            {n.icon}
          </NavLink>
        ))}

        <div className="nav-divider" />

        {/* Secondary icons — also NavLinks */}
        {SECONDARY_NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `nav-btn tip${isActive ? ' active' : ''}`}
            data-tip={n.label}
          >
            {n.icon}
          </NavLink>
        ))}

        {/* Footer */}
        <div className="sidebar-footer">
          <button
            className="nav-btn tip"
            data-tip="Sign out"
            onClick={logout}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
          <div
            className="avatar tip"
            style={{ width: 34, height: 34, fontSize: 13 }}
            data-tip={user?.name ?? 'Profile'}
          >
            {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
        </div>
      </aside>

      {/* ────────────────── MAIN ────────────────── */}
      <div className="main-wrapper">

        {/* Topbar — exact match to the image */}
        <header className="topbar-header">

          {/* Search */}
          <div className="tb-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input placeholder="Type to search…" />
          </div>

          {/* AI Assistant — with mic icon */}
          <button className="tb-ai">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            AI Assistant
          </button>

          <div className="tb-spacer" />

          {/* Dark Mode toggle pill */}
          <div className="tb-darkmode">
            Dark Mode
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </div>

          {/* Notification bell */}
          <button className="ib">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="notif-dot" />
          </button>

          {/* User avatar */}
          <div
            className="avatar"
            style={{ width: 34, height: 34, fontSize: 13 }}
            title={user?.name ?? 'Profile'}
          >
            {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
        </header>

        <main className="main">{children}</main>
      </div>
    </div>
  );
}
