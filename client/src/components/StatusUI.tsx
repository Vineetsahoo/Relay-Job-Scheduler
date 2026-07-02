import { JobStatus } from '../api/types';

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>;
}

/** A control-room style signal dot: pulsing amber = active, green = healthy, red = down, gray = idle. */
export function SignalDot({ tone }: { tone: 'success' | 'danger' | 'info' | 'neutral' | 'accent' }) {
  return <span className={`dot dot-${tone}`} />;
}

export function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}
