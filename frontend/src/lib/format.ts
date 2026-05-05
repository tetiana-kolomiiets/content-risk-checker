export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) {
    return '—';
  }

  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);

  if (sec < 60) {
    return 'just now';
  }

  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}m ago`;
  }

  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return `${hr}h ago`;
  }

  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function truncate(text: string, max = 80): string {
  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max - 1)}…`;
}
