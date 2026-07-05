import { createContext, useContext, useState, ReactNode } from 'react';
import { api, setToken } from './api/client';

interface User {
  id: string;
  name: string;
  email: string;
  isDemo?: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginAsDemo: () => void;
  register: (name: string, email: string, password: string, organizationName: string) => Promise<void>;
  logout: () => void;
}

// Demo admin credentials — these match the seed script in server/src/seed.ts
export const DEMO_CREDENTIALS = {
  email: 'admin@demo.com',
  password: 'demo1234',
} as const;

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_USER: User = {
  id: 'demo-admin-001',
  name: 'Admin Demo',
  email: DEMO_CREDENTIALS.email,
  isDemo: true,
};

// A lightweight fake token so the API client always sends an Authorization header.
// The server seed script creates a real user at this email, so real API calls will
// also work once the backend is seeded and the demo user logs in normally.
const DEMO_TOKEN = 'demo-mode-token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  /** One-click demo login — tries the real API first; falls back to local mock. */
  function loginAsDemo() {
    setLoading(true);
    api
      .post('/api/auth/login', DEMO_CREDENTIALS)
      .then((res: any) => {
        setToken(res.token);
        const u: User = { ...res.user, isDemo: true };
        localStorage.setItem('user', JSON.stringify(u));
        setUser(u);
      })
      .catch(() => {
        // Backend not seeded yet — use client-side mock so the UI is still explorable
        setToken(DEMO_TOKEN);
        localStorage.setItem('user', JSON.stringify(DEMO_USER));
        setUser(DEMO_USER);
      })
      .finally(() => setLoading(false));
  }

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      setToken(res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  }

  async function register(name: string, email: string, password: string, organizationName: string) {
    setLoading(true);
    try {
      const res = await api.post('/api/auth/register', {
        name,
        email,
        password,
        organization_name: organizationName,
      });
      setToken(res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken(null);
    localStorage.removeItem('user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginAsDemo, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
