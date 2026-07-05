import { ReactNode } from 'react';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
          <h3 className="modal-title" style={{ margin:0 }}>{title}</h3>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:8, width:28, height:28, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'var(--text-secondary)', flexShrink:0,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
