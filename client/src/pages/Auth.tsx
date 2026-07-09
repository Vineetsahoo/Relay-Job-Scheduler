import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, DEMO_CREDENTIALS } from '../AuthContext';
import { RelayLogo } from '../components/RelayLogo';

/* ─── tiny stat chip ─── */
function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      borderTop: '1px solid rgba(255,255,255,0.1)',
      paddingTop: 12,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>
        {value}
      </span>
    </div>
  );
}

/* ─── feature row ─── */
function Feature({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{
        marginTop: 1, width: 18, height: 18, borderRadius: '50%',
        border: '1.5px solid rgba(255,255,255,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <path d="m2.5 6 2.5 2.5 4.5-5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login, loginAsDemo, register, loading } = useAuth();
  const navigate = useNavigate();

  function handleDemoLogin() {
    loginAsDemo();
    navigate('/');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      mode === 'login'
        ? await login(email, password)
        : await register(name, email, password, orgName);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg-base)',
      fontFamily: 'var(--font)',
    }}>

      {/* ── Ambient background orbs ── */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '-15%', left: '-10%',
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(155,89,245,0.18) 0%, transparent 65%)',
          borderRadius: '50%',
        }}/>
        <div style={{
          position: 'absolute', bottom: '-10%', right: '-5%',
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(224,64,160,0.12) 0%, transparent 65%)',
          borderRadius: '50%',
        }}/>
        <div style={{
          position: 'absolute', top: '40%', right: '35%',
          width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(96,165,250,0.06) 0%, transparent 65%)',
          borderRadius: '50%',
        }}/>
      </div>

      {/* ════════════════════════════════════════
          LEFT PANEL — brand / marketing
          ════════════════════════════════════════ */}
      <div style={{
        display: 'none',
        position: 'relative', zIndex: 1,
        flex: '0 0 480px',
        background: 'linear-gradient(145deg, #13131e 0%, #0e0e17 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '52px 48px',
        // Show on desktop only via media query — handled below via className
      }}
        className="auth-left-panel"
      >
        {/* Top: wordmark */}
        <div>
          <RelayLogo size={40} wordmark />
          <p style={{ marginTop: 10, fontSize: 12.5, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em' }}>
            Distributed job scheduler
          </p>
        </div>

        {/* Centre: headline + features */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28, paddingTop: 40 }}>
          <div>
            <p style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: '#c471f5', marginBottom: 14,
            }}>
              Built for production teams
            </p>
            <h2 style={{
              fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em',
              lineHeight: 1.1, color: '#fff', maxWidth: 340,
            }}>
              Queue, schedule,<br />and monitor jobs<br />at any scale
            </h2>
            <p style={{ marginTop: 16, fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: 340 }}>
              Relay gives your engineering team a reliable backbone for background processing — with real-time visibility into every job, queue, and worker.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Feature text="Priority queues with configurable concurrency limits" />
            <Feature text="Exponential, linear, and fixed retry strategies" />
            <Feature text="Dead-letter queue with one-click retry or discard" />
            <Feature text="Live worker heartbeats and throughput charts" />
          </div>
        </div>

        {/* Bottom: stat chips */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, paddingTop: 40 }}>
          <StatChip label="Queues" value="11" />
          <StatChip label="Jobs / day" value="680+" />
          <StatChip label="Uptime" value="99.9%" />
        </div>
      </div>

      {/* ════════════════════════════════════════
          RIGHT PANEL — auth form
          ════════════════════════════════════════ */}
      <div style={{
        position: 'relative', zIndex: 1,
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 420,
          animation: 'auth-card-in 0.4s cubic-bezier(.34,1.56,.64,1) both',
        }}>

          {/* Mobile-only logo */}
          <div className="auth-mobile-logo" style={{ marginBottom: 36, textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <RelayLogo size={42} wordmark />
              <span style={{ fontSize: 11.5, color: 'var(--text-faint)', letterSpacing: '0.04em' }}>Distributed job scheduler</span>
            </div>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{
              fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em',
              color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 6,
            }}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {mode === 'login'
                ? 'Sign in to your workspace to manage queues and jobs.'
                : 'Set up your workspace in seconds.'}
            </p>
          </div>

          {/* ── Demo admin banner ── */}
          <div style={{
            marginBottom: 24,
            borderRadius: 14,
            border: '1px solid rgba(155,89,245,0.28)',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(168,85,247,0.07) 100%)',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            {/* Icon */}
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(155,89,245,0.35) 0%, rgba(224,64,160,0.25) 100%)',
              border: '1px solid rgba(155,89,245,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c471f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M6 20v-1a6 6 0 0 1 12 0v1"/>
                <path d="M18 14l1.5 1.5L22 13"/>
              </svg>
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c471f5', marginBottom: 4 }}>
                Admin demo
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, background: 'rgba(155,89,245,0.1)', padding: '1px 5px', borderRadius: 4, color: 'var(--text-primary)' }}>
                  {DEMO_CREDENTIALS.email}
                </code>
                {' · '}
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, background: 'rgba(155,89,245,0.1)', padding: '1px 5px', borderRadius: 4, color: 'var(--text-primary)' }}>
                  {DEMO_CREDENTIALS.password}
                </code>
              </div>
            </div>

            {/* CTA */}
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              style={{
                flexShrink: 0,
                padding: '8px 16px',
                fontSize: 12, fontWeight: 700,
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(155,89,245,0.5) 0%, rgba(224,64,160,0.35) 100%)',
                border: '1px solid rgba(155,89,245,0.4)',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                letterSpacing: '0.02em',
              }}
            >
              {loading ? '…' : '⚡ Try it'}
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              or continue with email
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Mode toggle */}
          <div className="pill-toggle" style={{ marginBottom: 24, width: '100%' }}>
            <button style={{ flex: 1, textAlign: 'center' }} className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
              Sign in
            </button>
            <button style={{ flex: 1, textAlign: 'center' }} className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
              Create account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {mode === 'register' && (
              <>
                <div className="field">
                  <label>Your name</label>
                  <input value={name} onChange={e => setName(e.target.value)} required placeholder="Ada Lovelace" />
                </div>
                <div className="field">
                  <label>Organization</label>
                  <input value={orgName} onChange={e => setOrgName(e.target.value)} required placeholder="Acme Inc." />
                </div>
              </>
            )}
            <div className="field">
              <label>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div className="field" style={{ marginBottom: 4 }}>
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Min. 8 characters" />
            </div>

            {error && (
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 10, color: 'var(--danger)',
                fontSize: 12.5, fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 18,
                width: '100%', padding: '13px',
                fontSize: 14, fontWeight: 700,
                borderRadius: 12, border: 'none',
                background: 'var(--grad-brand)',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                boxShadow: '0 4px 20px rgba(155,89,245,0.4)',
                transition: 'all 0.2s',
                letterSpacing: '-0.01em',
              }}
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in →' : 'Create account →'}
            </button>
          </form>

          {/* Toggle link */}
          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
            {mode === 'login' ? (
              <>Don't have an account?{' '}
                <button onClick={() => setMode('register')} style={{ background: 'none', border: 'none', color: '#c471f5', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                  Create one
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: '#c471f5', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                  Sign in
                </button>
              </>
            )}
          </div>

          {/* Footer note */}
          <p style={{ marginTop: 32, textAlign: 'center', fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.6 }}>
            By signing in you agree to the{' '}
            <span style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}>Terms of Service</span>
            {' '}and{' '}
            <span style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}>Privacy Policy</span>.
          </p>
        </div>
      </div>

      {/* ── Inline styles for responsive + animation ── */}
      <style>{`
        @keyframes auth-card-in {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to   { opacity: 1; transform: none; }
        }
        .auth-left-panel {
          display: none !important;
        }
        @media (min-width: 900px) {
          .auth-left-panel {
            display: flex !important;
          }
          .auth-mobile-logo {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
