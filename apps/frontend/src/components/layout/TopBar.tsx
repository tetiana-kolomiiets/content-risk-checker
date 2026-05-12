import { useEffect, useState } from 'react';
import { FiAlertTriangle, FiChevronDown } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { HealthStatus } from '@/lib/types';

export function TopBar() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const healthStatus = await api.health();
        if (!cancelled) {
          setHealth(healthStatus);
          setHealthError(false);
        }
      } catch {
        if (!cancelled) {
          setHealthError(true);
        }
      }
    }

    checkHealth();
    const intervalId = setInterval(checkHealth, 10_000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  const isHealthy = !healthError && health?.status === 'ok';

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-surface px-6">
      <Link to="/" className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-xs font-medium text-white">
          CRC
        </div>
        <span className="text-base font-medium">Content risk checker</span>
      </Link>

      <div className="flex-1" />

      <div className="flex items-center gap-2 text-sm">
        {isHealthy ? (
          <>
            <span className="h-2 w-2 rounded-full bg-risk-low" />
            <span className="text-text-secondary">Healthy</span>
          </>
        ) : (
          <>
            <FiAlertTriangle className="h-4 w-4 text-risk-high" />
            <span className="text-text-secondary">Issue</span>
          </>
        )}
      </div>

      <button
        type="button"
        className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm hover:border-border-strong"
      >
        Prompt v1
        <FiChevronDown className="h-3 w-3" />
      </button>
    </header>
  );
}
