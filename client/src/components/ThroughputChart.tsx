interface Bucket {
  bucket: string;
  completed: number;
  failed: number;
}

/** A minimal stacked bar chart, no charting library required. */
export function ThroughputChart({ data }: { data: Bucket[] }) {
  if (data.length === 0) {
    return <div className="empty-state">No completed jobs in this window yet.</div>;
  }

  const width = 900;
  const height = 160;
  const barGap = 4;
  const barWidth = Math.max(4, width / data.length - barGap);
  const max = Math.max(1, ...data.map((d) => d.completed + d.failed));

  return (
    <svg viewBox={`0 0 ${width} ${height + 24}`} width="100%" style={{ display: 'block' }}>
      {data.map((d, i) => {
        const total = d.completed + d.failed;
        const totalH = (total / max) * height;
        const failedH = (d.failed / max) * height;
        const completedH = totalH - failedH;
        const x = i * (barWidth + barGap);
        return (
          <g key={d.bucket}>
            <rect
              x={x}
              y={height - totalH}
              width={barWidth}
              height={completedH}
              fill="var(--success)"
              opacity={0.9}
              rx={3}
            />
            <rect
              x={x}
              y={height - failedH}
              width={barWidth}
              height={failedH}
              fill="var(--danger)"
              opacity={0.9}
              rx={3}
            />
            <title>
              {new Date(d.bucket).toLocaleString()}: {d.completed} completed, {d.failed} failed
            </title>
          </g>
        );
      })}
      <line x1={0} y1={height} x2={width} y2={height} stroke="var(--border)" strokeWidth={1} />
    </svg>
  );
}
