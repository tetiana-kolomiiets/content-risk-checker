import { useMemo, useState } from 'react';
import {
  FiAlignLeft,
  FiBarChart2,
  FiCheckSquare,
  FiChevronDown,
  FiCopy,
  FiCpu,
  FiDatabase,
  FiSave,
} from 'react-icons/fi';
import { formatDuration } from '@/lib/format';
import type { CheckStatus, StepLog, StepName, StepStatus } from '@/lib/types';
import type { ComponentType } from 'react';

const STEP_META: Record<StepName, { label: string; Icon: ComponentType<{ className?: string }> }> = {
  NORMALIZE_TEXT: { label: 'Normalize text', Icon: FiAlignLeft },
  DETECT_DUPLICATE: { label: 'Detect duplicate', Icon: FiCopy },
  RUN_RULE_BASED_CHECKS: { label: 'Rule-based scan', Icon: FiCheckSquare },
  RETRIEVE_AI_CONTEXT: { label: 'Retrieve context', Icon: FiDatabase },
  RUN_AI_ANALYSIS: { label: 'AI analysis', Icon: FiCpu },
  AGGREGATE_RESULT: { label: 'Aggregate result', Icon: FiBarChart2 },
  PERSIST_AI_MEMORY: { label: 'Persist AI memory', Icon: FiSave },
};

const PIPELINE_ORDER: StepName[] = [
  'NORMALIZE_TEXT',
  'DETECT_DUPLICATE',
  'RUN_RULE_BASED_CHECKS',
  'RETRIEVE_AI_CONTEXT',
  'RUN_AI_ANALYSIS',
  'AGGREGATE_RESULT',
  'PERSIST_AI_MEMORY',
];

const STATUS_PRIORITY: Record<StepStatus, number> = {
  FAILED: 4,
  COMPLETED: 3,
  SKIPPED: 2,
  STARTED: 1,
};

interface AttemptSummary {
  attempt: number;
  log: StepLog;
}

interface StepGroup {
  stepName: StepName;
  attempts: AttemptSummary[];
}

interface PipelineTimelineProps {
  logs: StepLog[];
  currentStep?: StepName | null;
  checkStatus?: CheckStatus;
}

function pickRepresentativeLog(logs: StepLog[]): StepLog {
  return [...logs].sort((a, b) => {
    const priorityDiff = STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  })[0];
}

export function PipelineTimeline({ logs, currentStep, checkStatus }: PipelineTimelineProps) {
  const groups = useMemo<StepGroup[]>(() => {
    const byStep = new Map<StepName, Map<number, StepLog[]>>();
    for (const log of logs) {
      let perAttempt = byStep.get(log.stepName);
      if (!perAttempt) {
        perAttempt = new Map();
        byStep.set(log.stepName, perAttempt);
      }
      const existing = perAttempt.get(log.attempt);
      if (existing) {
        existing.push(log);
      } else {
        perAttempt.set(log.attempt, [log]);
      }
    }

    return PIPELINE_ORDER.filter((name) => byStep.has(name)).map((name) => {
      const perAttempt = byStep.get(name)!;
      const attemptNumbers = [...perAttempt.keys()].sort((a, b) => a - b);
      const attempts = attemptNumbers.map((attempt) => ({
        attempt,
        log: pickRepresentativeLog(perAttempt.get(attempt)!),
      }));
      return { stepName: name, attempts };
    });
  }, [logs]);

  const isTerminal = checkStatus === 'COMPLETED' || checkStatus === 'FAILED';
  const activeStepName: StepName | null = !isTerminal ? currentStep ?? null : null;
  const activeStepIndex = activeStepName
    ? groups.findIndex((group) => group.stepName === activeStepName)
    : -1;

  return (
    <div className="space-y-0">
      {groups.map((group, index) => (
        <StepRow
          key={group.stepName}
          group={group}
          isActiveStep={activeStepName === group.stepName}
          isBeforeActive={activeStepIndex !== -1 && index < activeStepIndex}
        />
      ))}
    </div>
  );
}

function StepRow({
  group,
  isActiveStep,
  isBeforeActive,
}: {
  group: StepGroup;
  isActiveStep: boolean;
  isBeforeActive: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = STEP_META[group.stepName];

  if (!meta) {
    return null;
  }

  const latest = group.attempts[group.attempts.length - 1];
  const previousAttempts = group.attempts.slice(0, -1);
  const hasDetails = latest.log.details != null && Object.keys(latest.log.details).length > 0;
  const hasRetries = previousAttempts.length > 0;
  const canExpand = hasDetails || hasRetries;
  const { Icon, label } = meta;
  const displayStatus = resolveDisplayStatus(latest.log.status, isActiveStep, isBeforeActive);

  return (
    <div className="last:border-0 border-b border-border-subtle">
      <button
        type="button"
        onClick={() => {
          if (canExpand) {
            setExpanded((isExpanded) => !isExpanded);
          }
        }}
        className={`flex w-full items-center gap-3 py-3 ${canExpand ? 'cursor-pointer hover:bg-bg' : 'cursor-default'}`}
        disabled={!canExpand}
      >
        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${iconBgClass(displayStatus)}`}>
          <Icon className={`h-4 w-4 ${iconColorClass(displayStatus)}`} />
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{label}</span>
            {hasRetries && (
              <span className="rounded bg-border-subtle px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
                ×{group.attempts.length} attempts
              </span>
            )}
          </div>
          <StatusLabel status={displayStatus} errorCode={latest.log.errorCode} />
        </div>
        <span className="text-xs font-mono text-text-secondary">{formatDuration(latest.log.durationMs)}</span>
        {canExpand && (
          <FiChevronDown className={`h-3 w-3 text-text-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`} />
        )}
      </button>

      {expanded && canExpand && (
        <div className="space-y-2 pb-3 pl-11 pr-4">
          {hasRetries && <PreviousAttempts attempts={previousAttempts} />}
          {hasDetails && (
            <pre className="overflow-x-auto rounded border border-border-subtle bg-bg p-2 font-mono text-xs">
              {JSON.stringify(latest.log.details, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function PreviousAttempts({ attempts }: { attempts: AttemptSummary[] }) {
  return (
    <div className="rounded border border-border-subtle bg-bg">
      <div className="border-b border-border-subtle px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
        Previous attempts
      </div>
      <ul className="divide-y divide-border-subtle">
        {attempts.map(({ attempt, log }) => (
          <li key={`${attempt}-${log.id}`} className="flex items-center gap-2 px-2 py-1.5 text-xs">
            <span className="font-mono text-text-tertiary">#{attempt}</span>
            <span className={`flex-1 ${log.status === 'FAILED' ? 'text-risk-high' : 'text-text-secondary'}`}>
              {log.status === 'FAILED'
                ? log.errorCode ?? log.errorMessage ?? 'Failed'
                : capitalize(log.status)}
            </span>
            <span className="font-mono text-text-tertiary">{formatDuration(log.durationMs)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type DisplayStatus = StepStatus | 'IN_PROGRESS' | 'PENDING';

function resolveDisplayStatus(
  status: StepStatus,
  isActiveStep: boolean,
  isBeforeActive: boolean,
): DisplayStatus {
  if (isActiveStep) {
    return status === 'STARTED' ? 'IN_PROGRESS' : status;
  }
  if (isBeforeActive) {
    if (status === 'FAILED' || status === 'SKIPPED') {
      return status;
    }
    return 'COMPLETED';
  }
  if (status === 'STARTED') {
    return 'PENDING';
  }
  return status;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function iconBgClass(status: DisplayStatus): string {
  if (status === 'COMPLETED') {
    return 'bg-risk-low/10';
  }
  if (status === 'FAILED') {
    return 'bg-risk-high/10';
  }
  if (status === 'SKIPPED') {
    return 'bg-border-subtle';
  }
  if (status === 'IN_PROGRESS') {
    return 'bg-info/10';
  }
  return 'bg-border-subtle';
}

function iconColorClass(status: DisplayStatus): string {
  if (status === 'COMPLETED') {
    return 'text-risk-low';
  }
  if (status === 'FAILED') {
    return 'text-risk-high';
  }
  if (status === 'SKIPPED') {
    return 'text-text-tertiary';
  }
  if (status === 'IN_PROGRESS') {
    return 'text-info';
  }
  return 'text-text-tertiary';
}

function StatusLabel({ status, errorCode }: { status: DisplayStatus; errorCode: string | null }) {
  if (status === 'COMPLETED') {
    return <div className="mt-0.5 text-xs text-text-tertiary">Completed</div>;
  }
  if (status === 'FAILED') {
    return <div className="mt-0.5 font-mono text-xs text-risk-high">{errorCode ?? 'Failed'}</div>;
  }
  if (status === 'SKIPPED') {
    return <div className="mt-0.5 text-xs text-text-tertiary">Skipped</div>;
  }
  if (status === 'IN_PROGRESS') {
    return <div className="mt-0.5 text-xs text-info">In progress</div>;
  }
  return <div className="mt-0.5 text-xs text-text-tertiary">Pending</div>;
}
