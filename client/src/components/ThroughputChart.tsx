import { useRef, useState, useCallback } from 'react';

interface Bucket { bucket: string; completed: number; failed: number; }

interface Tip { x: number; y: number; d: Bucket; visible: boolean; }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function ThroughputChart({ data }: { data: Bucket[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>({ x:0, y:0, d: { bucket:'', completed:0, failed:0 }, visible:false });

  /* chart dimensions */
  const W = 880, H = 190, GAP = 4;
  const n = Math.max(data.length, 9);           /* always render at least 9 bars like image */
  const barW = Math.max(6, (W - GAP * (n - 1)) / n);
  const max  = Math.max(1, ...data.map(d => d.completed + d.failed));

  /* synthesise empty bars so chart always looks full like the image */
  const MONTHS_LABELS = MONTHS;
  const bars: Array<Bucket & { label?: string }> = data.length > 0
    ? data
    : MONTHS_LABELS.map(m => ({ bucket: m, completed: 0, failed: 0, label: m }));

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGGElement>, d: Bucket) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, d, visible: true });
  }, []);

  const isEmpty = data.length === 0;

  /* Determine label spacing */
  const labelStep = Math.max(1, Math.floor(bars.length / 9));

  return (
    <div ref={wrapRef} style={{ position: 'relative', userSelect: 'none' }}>

      {/* Floating tooltip */}
      {tip.visible && !isEmpty && (
        <div
          className="chart-tip"
          style={{
            left:  Math.min(tip.x + 14, (wrapRef.current?.clientWidth ?? 500) - 170),
            top:   Math.max(tip.y - 80, 4),
          }}
        >
          <div className="chart-tip-title">
            {(() => {
              try {
                const d = new Date(tip.d.bucket);
                return isNaN(d.getTime()) ? tip.d.bucket
                  : d.toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
              } catch { return tip.d.bucket; }
            })()}
          </div>
          <div className="chart-tip-row">
            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span className="chart-tip-dot" style={{ background:'linear-gradient(135deg,#d8b4fe,#e040a0)' }}/>
              Completed
            </span>
            <span style={{ fontWeight:700, color:'var(--text-primary)' }}>{tip.d.completed}</span>
          </div>
          {tip.d.failed > 0 && (
            <div className="chart-tip-row">
              <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                <span className="chart-tip-dot" style={{ background:'var(--danger)' }}/>
                Failed
              </span>
              <span style={{ fontWeight:700, color:'var(--danger)' }}>{tip.d.failed}</span>
            </div>
          )}
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H + 30}`}
        width="100%"
        style={{ display:'block', overflow:'visible' }}
        onMouseLeave={() => setTip(t => ({ ...t, visible:false }))}
      >
        <defs>
          {/* THE bar gradient — light lavender → purple → hot pink, from top to bottom */}
          <linearGradient id="cg-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#e9d5ff" stopOpacity="1"/>
            <stop offset="25%"  stopColor="#c471f5" stopOpacity="0.97"/>
            <stop offset="60%"  stopColor="#9b59f5" stopOpacity="0.95"/>
            <stop offset="100%" stopColor="#e040a0" stopOpacity="0.88"/>
          </linearGradient>

          {/* Glow for tall bars */}
          <filter id="cg-glow" x="-40%" y="-20%" width="180%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>

          {/* CROSSHATCH pattern — exactly as in the image for empty / background bars */}
          <pattern id="cg-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45 0 0)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.055)" strokeWidth="2"/>
          </pattern>

          {/* Clip top two corners rounded per bar */}
          <clipPath id="cg-clip-bar">
            <rect x="0" y="0" width="100" height="200" rx="5" ry="5"/>
          </clipPath>

          {/* Failed gradient */}
          <linearGradient id="cg-fail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#f87171" stopOpacity="0.65"/>
          </linearGradient>
        </defs>

        {/* Grid lines — barely visible */}
        {[0.25, 0.5, 0.75, 1.0].map(f => (
          <line
            key={f}
            x1={0} y1={H * (1 - f)} x2={W} y2={H * (1 - f)}
            stroke="rgba(255,255,255,0.035)"
            strokeWidth={1}
            strokeDasharray="3 6"
          />
        ))}

        {/* Bars */}
        {bars.map((d, i) => {
          const x      = i * (barW + GAP);
          const total  = d.completed + d.failed;
          const totalH = isEmpty ? 0 : (total / max) * H;
          const failH  = isEmpty ? 0 : (d.failed / max) * H;
          const compH  = totalH - failH;
          const isActive = !isEmpty && total > 0;

          return (
            <g
              key={i}
              style={{ cursor: isActive ? 'pointer' : 'default' }}
              onMouseMove={isActive ? (e) => handleMouseMove(e, d) : undefined}
              onMouseLeave={() => setTip(t => ({ ...t, visible:false }))}
            >
              {/* Full-height background bar — always shows hatch */}
              <rect
                x={x} y={0}
                width={barW} height={H}
                fill="url(#cg-hatch)"
                rx={5}
              />
              {/* Very dim bg track */}
              <rect
                x={x} y={0}
                width={barW} height={H}
                fill="rgba(255,255,255,0.015)"
                rx={5}
              />

              {/* Completed segment */}
              {compH > 0 && (
                <rect
                  x={x}
                  y={H - totalH}
                  width={barW}
                  height={compH}
                  fill="url(#cg-bar)"
                  rx={5}
                  style={{
                    filter: compH > H * 0.25 ? 'url(#cg-glow)' : undefined,
                  }}
                />
              )}

              {/* Failed segment on top */}
              {failH > 0 && (
                <rect
                  x={x}
                  y={H - failH}
                  width={barW}
                  height={failH}
                  fill="url(#cg-fail)"
                  rx={5}
                />
              )}
            </g>
          );
        })}

        {/* Baseline */}
        <line x1={0} y1={H} x2={W} y2={H} stroke="rgba(255,255,255,0.055)" strokeWidth={1}/>

        {/* X-axis labels */}
        {bars.map((d, i) => {
          if (i % labelStep !== 0) return null;
          const cx = i * (barW + GAP) + barW / 2;
          let label: string;
          try {
            const dt = new Date(d.bucket);
            label = isNaN(dt.getTime())
              ? (d.bucket.length <= 4 ? d.bucket : d.bucket.slice(0,3))
              : dt.toLocaleDateString(undefined, { month:'short' });
          } catch { label = d.bucket.slice(0,3); }
          return (
            <text
              key={`lbl-${i}`}
              x={cx} y={H + 20}
              textAnchor="middle"
              fontSize={11}
              fill="rgba(255,255,255,0.28)"
              fontFamily="Inter, sans-serif"
              fontWeight="500"
            >
              {label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display:'flex', gap:20, marginTop:8, fontSize:12, fontWeight:500 }}>
        <span style={{ display:'flex', alignItems:'center', gap:6, color:'var(--text-secondary)' }}>
          <span style={{
            width:10, height:10, borderRadius:2,
            background:'linear-gradient(135deg,#e9d5ff,#e040a0)',
            display:'inline-block',
          }}/>
          Completed
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:6, color:'var(--text-secondary)' }}>
          <span style={{ width:10, height:10, borderRadius:2, background:'var(--danger)', display:'inline-block' }}/>
          Failed
        </span>
      </div>
    </div>
  );
}
