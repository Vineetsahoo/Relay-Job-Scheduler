/**
 * Relay — custom SVG logo mark
 *
 * Concept: three staggered "relay nodes" connected by arcs,
 * suggesting jobs passing through a pipeline. The nodes pulse
 * outward like a signal relay. Rendered in the brand
 * purple→violet→pink gradient.
 */

interface RelayLogoProps {
  /** Outer container size in px (it's always square) */
  size?: number;
  /** Show the wordmark next to the mark */
  wordmark?: boolean;
  /** Extra class on the root element */
  className?: string;
}

export function RelayLogo({ size = 36, wordmark = false, className = '' }: RelayLogoProps) {
  const id = 'rl'; // short prefix to avoid SVG id collisions

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.28, flexShrink: 0 }}
    >
      {/* ── The mark ── */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Relay logo mark"
      >
        <defs>
          {/* Radial gradient — bright centre, fades to transparent */}
          <radialGradient id={`${id}-rg`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#fff" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
          </radialGradient>

          {/* Main brand linear gradient — purple → pink */}
          <linearGradient id={`${id}-lg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#9b59f5"/>
            <stop offset="50%"  stopColor="#c471f5"/>
            <stop offset="100%" stopColor="#e040a0"/>
          </linearGradient>

          {/* Stroke gradient for the connector arcs */}
          <linearGradient id={`${id}-sg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#c471f5" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#e040a0" stopOpacity="0.55"/>
          </linearGradient>

          {/* Glow filter */}
          <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Rounded square clip for the outer container */}
          <clipPath id={`${id}-clip`}>
            <rect width="40" height="40" rx="11" ry="11"/>
          </clipPath>
        </defs>

        {/* ── Background square with gradient fill ── */}
        <rect
          width="40" height="40"
          rx="11" ry="11"
          fill={`url(#${id}-lg)`}
        />

        {/* Subtle inner highlight */}
        <rect
          width="40" height="40"
          rx="11" ry="11"
          fill={`url(#${id}-rg)`}
        />

        {/* ── Logo mark: three relay nodes + connecting arcs ──
             Nodes sit at a slight diagonal (like a flow):
             Node A — top-left  (10, 13)
             Node B — centre    (20, 20)  ← anchor / hub
             Node C — top-right (30, 13)
             Output — bottom    (20, 30)
        ── */}
        <g clipPath={`url(#${id}-clip)`} filter={`url(#${id}-glow)`}>

          {/* Arc: A → B */}
          <path
            d="M10 13 Q 14 20 20 20"
            stroke="white"
            strokeOpacity="0.75"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />

          {/* Arc: C → B */}
          <path
            d="M30 13 Q 26 20 20 20"
            stroke="white"
            strokeOpacity="0.75"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />

          {/* Arc: B → Output */}
          <path
            d="M20 20 L20 29"
            stroke="white"
            strokeOpacity="0.85"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />

          {/* ── Node A ── top-left input */}
          <circle cx="10" cy="13" r="3.2" fill="white" fillOpacity="0.9"/>
          <circle cx="10" cy="13" r="1.5" fill="white"/>

          {/* ── Node C ── top-right input */}
          <circle cx="30" cy="13" r="3.2" fill="white" fillOpacity="0.9"/>
          <circle cx="30" cy="13" r="1.5" fill="white"/>

          {/* ── Node B ── hub (slightly larger) */}
          <circle cx="20" cy="20" r="4" fill="white" fillOpacity="0.2"/>
          <circle cx="20" cy="20" r="2.6" fill="white" fillOpacity="0.95"/>
          <circle cx="20" cy="20" r="1.2" fill="white"/>

          {/* ── Output node ── bottom, solid */}
          <circle cx="20" cy="29" r="3.2" fill="white" fillOpacity="0.92"/>
          {/* Arrow head on the output */}
          <path
            d="M17.5 27.2 L20 29.8 L22.5 27.2"
            stroke="white"
            strokeOpacity="0.0"
            strokeWidth="0"
            fill="none"
          />
        </g>

        {/* Subtle border */}
        <rect
          width="40" height="40"
          rx="11" ry="11"
          stroke="white"
          strokeOpacity="0.15"
          strokeWidth="1"
          fill="none"
        />
      </svg>

      {/* ── Wordmark ── */}
      {wordmark && (
        <span style={{
          fontFamily: '"Inter", sans-serif',
          fontWeight: 800,
          fontSize: size * 0.48,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          background: 'linear-gradient(135deg, #c471f5 0%, #e040a0 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          userSelect: 'none',
        }}>
          Relay
        </span>
      )}
    </span>
  );
}
