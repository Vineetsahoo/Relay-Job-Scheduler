import { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ProjectProvider } from './ProjectContext';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/Auth';
import { OverviewPage } from './pages/Overview';
import { QueuesPage } from './pages/Queues';
import { QueueDetailPage } from './pages/QueueDetail';
import { JobDetailPage } from './pages/JobDetail';
import { WorkersPage } from './pages/Workers';
import { DeadLetterPage } from './pages/DeadLetter';

function RequireAuth({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <ProjectProvider>
              <Layout>
                <Routes>
                  <Route path="/" element={<OverviewPage />} />
                  <Route path="/queues" element={<QueuesPage />} />
                  <Route path="/queues/:id" element={<QueueDetailPage />} />
                  <Route path="/jobs/:id" element={<JobDetailPage />} />
                  <Route path="/workers" element={<WorkersPage />} />
                  <Route path="/dead-letter" element={<DeadLetterPage />} />
                </Routes>
              </Layout>
            </ProjectProvider>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
