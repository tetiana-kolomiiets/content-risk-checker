import { useState } from 'react';
import {
  FiAlignLeft,
  FiBarChart2,
  FiCheckSquare,
  FiChevronDown,
  FiCopy,
  FiCpu,
  FiDatabase,
} from 'react-icons/fi';
import { formatDuration } from '@/lib/format';
import type { StepLog, StepName, StepStatus } from '@/lib/types';
import type { ComponentType } from 'react';

const STEP_META: Record<StepName, { label: string; Icon: ComponentType<{ className?: string }> }> = {
  NORMALIZE_TEXT: { label: 'Normalize text', Icon: FiAlignLeft },
  DETECT_DUPLICATE: { label: 'Detect duplicate', Icon: FiCopy },
  RUN_RULE_BASED_CHECKS: { label: 'Rule-based scan', Icon: FiCheckSquare },
  RETRIEVE_AI_CONTEXT: { label: 'Retrieve context', Icon: FiDatabase },
  RUN_AI_ANALYSIS: { label: 'AI analysis', Icon: FiCpu },
  AGGREGATE_RESULT: { label: 'Aggregate result', Icon: FiBarChart2 },
};

export function PipelineTimeline({ logs }: { logs: StepLog[] }) {
  return (
    <div className="space-y-0">
      {logs.map((log) => (
        <StepRow key={log.id} log={log} />
      ))}
    </div>
  );
}

function StepRow({ log }: { log: StepLog }) {
  const [expanded, setExpanded] = useState(false);
  const meta = STEP_META[log.stepName];

  if (!meta) {
    return null;
  }

  const hasDetails = Object.keys(log.details).length > 0;
  const { Icon, label } = meta;

  return (
    <div className="last:border-0 border-b border-border-subtle">
      <button
        type="button"
        onClick={() => {
          if (hasDetails) {
            setExpanded((isExpanded) => !isExpanded);
          }
        }}
        className={`flex w-full items-center gap-3 py-3 ${hasDetails ? 'cursor-pointer hover:bg-bg' : 'cursor-default'}`}
        disabled={!hasDetails}
      >
        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${iconBgClass(log.status)}`}>
          <Icon className={`h-4 w-4 ${iconColorClass(log.status)}`} />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium">{label}</div>
          <StatusLabel status={log.status} errorCode={log.errorCode} />
        </div>
        <span className="text-xs font-mono text-text-secondary">{formatDuration(log.durationMs)}</span>
        {hasDetails && (
          <FiChevronDown className={`h-3 w-3 text-text-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`} />
        )}
      </button>

      {expanded && hasDetails && (
        <div className="pb-3 pl-11 pr-4">
          <pre className="overflow-x-auto rounded border border-border-subtle bg-bg p-2 font-mono text-xs">
            {JSON.stringify(log.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function iconBgClass(status: StepStatus): string {
  if (status === 'COMPLETED') {
    return 'bg-risk-low/10';
  }
  if (status === 'FAILED') {
    return 'bg-risk-high/10';
  }
  if (status === 'SKIPPED') {
    return 'bg-border-subtle';
  }
  return 'bg-info/10';
}

function iconColorClass(status: StepStatus): string {
  if (status === 'COMPLETED') {
    return 'text-risk-low';
  }
  if (status === 'FAILED') {
    return 'text-risk-high';
  }
  if (status === 'SKIPPED') {
    return 'text-text-tertiary';
  }
  return 'text-info';
}

function StatusLabel({ status, errorCode }: { status: StepStatus; errorCode: string | null }) {
  if (status === 'COMPLETED') {
    return <div className="mt-0.5 text-xs text-text-tertiary">Completed</div>;
  }
  if (status === 'FAILED') {
    return <div className="mt-0.5 font-mono text-xs text-risk-high">{errorCode ?? 'Failed'}</div>;
  }
  if (status === 'SKIPPED') {
    return <div className="mt-0.5 text-xs text-text-tertiary">Skipped</div>;
  }
  return <div className="mt-0.5 text-xs text-info">In progress</div>;
}
