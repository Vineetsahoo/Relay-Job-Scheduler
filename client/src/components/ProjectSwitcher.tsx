import { useState } from 'react';
import { useProjects } from '../ProjectContext';

export function ProjectSwitcher() {
  const { projects, organizations, activeProject, setActiveProjectId, createProject } = useProjects();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  async function handleCreate() {
    if (!name.trim() || organizations.length === 0) return;
    await createProject(name.trim(), organizations[0].id);
    setName('');
    setCreating(false);
  }

  return (
    <div className="row" style={{ alignItems: 'center', gap: 8 }}>
      {projects.length > 0 && (
        <select
          value={activeProject?.id ?? ''}
          onChange={(e) => setActiveProjectId(e.target.value)}
          style={{ width: 200, borderRadius: 'var(--radius-pill)', fontWeight: 600 }}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}

      {creating ? (
        <>
          <input
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: 160 }}
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={handleCreate}>Create</button>
          <button className="btn btn-sm" onClick={() => setCreating(false)}>Cancel</button>
        </>
      ) : (
        <button className="btn btn-sm" onClick={() => setCreating(true)}>+ New project</button>
      )}
    </div>
  );
}
