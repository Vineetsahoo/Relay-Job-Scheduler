import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, DEMO_CREDENTIALS } from '../AuthContext';
import { RelayLogo } from '../components/RelayLogo';

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
    <div className="auth-screen">
      {/* Decorative background orbs */}
      <div style={{
        position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
          width: 700, height: 500,
          background: 'radial-gradient(ellipse, rgba(168,85,247,0.15) 0%, transparent 70%)',
          borderRadius: '50%',
        }}/>
        <div style={{
          position: 'absolute', bottom: '-10%', right: '10%',
          width: 400, height: 400,
          background: 'radial-gradient(ellipse, rgba(236,72,153,0.08) 0%, transparent 70%)',
          borderRadius: '50%',
        }}/>
      </div>

      <div className="auth-card" style={{ position: 'relative', zIndex: 1 }}>
        {/* Brand — custom Relay logo with wordmark */}
        <div style={{ marginBottom: 30 }}>
          <RelayLogo size={44} wordmark />
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 400, marginTop: 6, paddingLeft: 2 }}>
            Distributed job scheduler
          </div>
        </div>

        {/* Demo credentials banner */}
        <div style={{
          background: 'rgba(168,85,247,0.08)',
          border: '1px solid rgba(168,85,247,0.25)',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Demo access
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <span style={{ opacity: 0.7 }}>Email:</span>{' '}
              <code style={{ fontSize: 12, color: 'var(--text-primary)', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>
                {DEMO_CREDENTIALS.email}
              </code>
              <br />
              <span style={{ opacity: 0.7 }}>Password:</span>{' '}
              <code style={{ fontSize: 12, color: 'var(--text-primary)', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>
                {DEMO_CREDENTIALS.password}
              </code>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            style={{
              flexShrink: 0,
              padding: '8px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(168,85,247,0.4) 0%, rgba(168,85,247,0.2) 100%)',
              border: '1px solid rgba(168,85,247,0.5)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? '…' : '⚡ Use admin'}
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          <span style={{ fontSize: 11.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>or sign in manually</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
        </div>

        {/* Mode toggle */}
        <div className="pill-toggle" style={{ marginBottom: 24, width: '100%' }}>
          <button
            style={{ flex: 1, textAlign: 'center' }}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            Sign in
          </button>
          <button
            style={{ flex: 1, textAlign: 'center' }}
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <div className="field">
                <label>Your name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Ada Lovelace"
                />
              </div>
              <div className="field">
                <label>Organization</label>
                <input
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  required
                  placeholder="Acme Inc."
                />
              </div>
            </>
          )}
          <div className="field">
            <label>Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min. 8 characters"
            />
          </div>

          {error && <div className="error-text">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 10, padding: '12px', fontSize: 14, borderRadius: 10 }}
            disabled={loading}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-toggle" style={{ justifyContent: 'center', marginTop: 22 }}>
          {mode === 'login' ? (
            <>Don't have an account?&nbsp;<button onClick={() => setMode('register')}>Create one</button></>
          ) : (
            <>Already have an account?&nbsp;<button onClick={() => setMode('login')}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
