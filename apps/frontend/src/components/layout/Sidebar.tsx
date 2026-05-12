import { useEffect, useMemo, useState } from 'react';
import { FiInbox, FiPlus, FiSearch } from 'react-icons/fi';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatRelativeTime, truncate } from '@/lib/format';
import type { Check, CheckStatus } from '@/lib/types';

const FILTERS: { value: CheckStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PROCESSING', label: 'Active' },
  { value: 'COMPLETED', label: 'Done' },
  { value: 'FAILED', label: 'Failed' },
];

export function Sidebar() {
  const { id: activeId } = useParams<{ id: string }>();
  const [checks, setChecks] = useState<Check[]>([]);
  const [filter, setFilter] = useState<CheckStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    let pollingId: number | undefined;

    async function loadChecks() {
      try {
        const response = await api.listChecks({
          include: ['rawText'],
          ...(filter === 'ALL' ? {} : { status: filter }),
        });
        if (cancelled) {
          return;
        }

        setChecks(response.items);

        const hasActiveChecks = response.items.some(
          (check) => check.status === 'PENDING' || check.status === 'PROCESSING',
        );

        if (hasActiveChecks && pollingId == null) {
          pollingId = window.setInterval(loadChecks, 3000);
        }

        if (!hasActiveChecks && pollingId != null) {
          window.clearInterval(pollingId);
          pollingId = undefined;
        }
      } catch {
        // Ignore sidebar list errors and keep last known state.
      }
    }

    void loadChecks();

    return () => {
      cancelled = true;
      if (pollingId != null) {
        window.clearInterval(pollingId);
      }
    };
  }, [filter]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredChecks = useMemo(() => {
    if (!normalizedSearch) {
      return checks;
    }

    return checks.filter((check) => {
      const matchesId = check.id.toLowerCase().includes(normalizedSearch);
      const matchesText = check.rawText.toLowerCase().includes(normalizedSearch);
      return matchesId || matchesText;
    });
  }, [checks, normalizedSearch]);

  return (
    <aside className="flex w-80 flex-col border-r border-border bg-surface">
      <div className="border-b border-border p-4">
        <Link
          to="/"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          <FiPlus className="h-4 w-4" />
          New check
        </Link>
      </div>

      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <FiSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by id or text..."
            className="w-full rounded-md border border-border py-1.5 pl-8 pr-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        <div className="mt-2 flex gap-1 overflow-x-auto">
          {FILTERS.map((filterOption) => {
            const isFilterActive = filter === filterOption.value;

            return (
              <button
                key={filterOption.value}
                onClick={() => setFilter(filterOption.value)}
                className={`whitespace-nowrap rounded px-2 py-1 text-xs ${
                  isFilterActive
                    ? 'bg-accent/10 font-medium text-accent'
                    : 'text-text-secondary hover:bg-border-subtle hover:text-text-primary'
                }`}
              >
                {filterOption.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {checks.length === 0 ? (
          <div className="mt-10 flex flex-col items-center px-4 text-center">
            <div className="mb-3 rounded-full border border-border-subtle p-3">
              <FiInbox className="h-5 w-5 text-text-tertiary" aria-hidden="true" />
            </div>
            <p className="text-sm text-text-secondary">No checks yet</p>
            <p className="mt-1 text-xs text-text-tertiary">Submit your first check to see it here.</p>
          </div>
        ) : filteredChecks.length === 0 ? (
          <p className="px-3 py-2 text-center text-xs text-text-tertiary">No checks match.</p>
        ) : (
          filteredChecks.map((check) => (
            <SidebarItem key={check.id} check={check} active={check.id === activeId} />
          ))
        )}
      </div>
    </aside>
  );
}

function SidebarItem({ check, active }: { check: Check; active: boolean }) {
  const dotColorClass = getDotColorClass(check);
  const isActiveItem = active;

  return (
    <Link
      to={`/checks/${check.id}`}
      className={`flex items-center gap-3 rounded-md p-2.5 transition-colors ${
        isActiveItem ? 'bg-accent/10' : 'hover:bg-border-subtle'
      }`}
    >
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dotColorClass}`} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-text-primary">{truncate(check.rawText, 40)}</div>
        <div className="mt-0.5 text-xs text-text-tertiary">{formatRelativeTime(check.createdAt)}</div>
      </div>

      <SidebarBadge check={check} />
    </Link>
  );
}

function SidebarBadge({ check }: { check: Check }) {
  const isActiveCheck = check.status === 'PROCESSING' || check.status === 'PENDING';
  if (isActiveCheck) {
    return <Badge variant="info">Active</Badge>;
  }

  if (check.status === 'FAILED') {
    return <Badge variant="high">Failed</Badge>;
  }

  const riskLevel = check.analysisResult?.finalRiskLevel;
  if (riskLevel === 'HIGH') {
    return <Badge variant="high">High</Badge>;
  }

  if (riskLevel === 'MEDIUM') {
    return <Badge variant="medium">Medium</Badge>;
  }

  if (riskLevel === 'LOW') {
    return <Badge variant="low">Low</Badge>;
  }

  return null;
}

function getDotColorClass(check: Check): string {
  const isCompleted = check.status === 'COMPLETED';
  const riskLevel = check.analysisResult?.finalRiskLevel;
  const isFailed = check.status === 'FAILED';
  const isActive = check.status === 'PROCESSING' || check.status === 'PENDING';

  if (isCompleted && riskLevel === 'HIGH') {
    return 'bg-risk-high';
  }

  if (isCompleted && riskLevel === 'MEDIUM') {
    return 'bg-risk-medium';
  }

  if (isCompleted && riskLevel === 'LOW') {
    return 'bg-risk-low';
  }

  if (isFailed) {
    return 'bg-risk-high';
  }

  if (isActive) {
    return 'animate-pulse bg-info';
  }

  return 'bg-text-tertiary';
}
