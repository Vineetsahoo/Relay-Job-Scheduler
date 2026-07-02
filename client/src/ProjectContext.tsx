import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api/client';
import { Organization, Project } from './api/types';
import { useAuth } from './AuthContext';

interface ProjectContextValue {
  organizations: Organization[];
  projects: Project[];
  activeProject: Project | null;
  setActiveProjectId: (id: string) => void;
  createProject: (name: string, organizationId: string) => Promise<void>;
  refresh: () => Promise<void>;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(
    localStorage.getItem('activeProjectId')
  );
  const [loading, setLoading] = useState(true);

  function setActiveProjectId(id: string) {
    localStorage.setItem('activeProjectId', id);
    setActiveProjectIdState(id);
  }

  async function refresh() {
    if (!user) return;
    setLoading(true);
    try {
      const orgsRes = await api.get('/api/organizations');
      const orgs: Organization[] = orgsRes.data;
      setOrganizations(orgs);

      let allProjects: Project[] = [];
      for (const org of orgs) {
        const projRes = await api.get(`/api/projects?organization_id=${org.id}`);
        allProjects = allProjects.concat(projRes.data);
      }
      setProjects(allProjects);

      if (allProjects.length > 0 && !allProjects.find((p) => p.id === activeProjectId)) {
        setActiveProjectId(allProjects[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createProject(name: string, organizationId: string) {
    const project = await api.post('/api/projects', { name, organization_id: organizationId });
    setProjects((prev) => [project, ...prev]);
    setActiveProjectId(project.id);
  }

  useEffect(() => {
    if (user) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  return (
    <ProjectContext.Provider
      value={{ organizations, projects, activeProject, setActiveProjectId, createProject, refresh, loading }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjects must be used inside ProjectProvider');
  return ctx;
}
