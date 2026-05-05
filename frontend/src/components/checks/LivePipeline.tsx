import { useEffect, useMemo, useState } from 'react';
import { FiCheck, FiLoader, FiX } from 'react-icons/fi';
import { api } from '@/lib/api';
import type { Check, StepLog, StepName } from '@/lib/types';

const PIPELINE_STEPS: { name: StepName; label: string }[] = [
  { name: 'NORMALIZE_TEXT', label: 'Normalize text' },
  { name: 'DETECT_DUPLICATE', label: 'Detect duplicate' },
  { name: 'RUN_RULE_BASED_CHECKS', label: 'Rule-based scan' },
  { name: 'RETRIEVE_AI_CONTEXT', label: 'Retrieve context' },
  { name: 'RUN_AI_ANALYSIS', label: 'AI analysis' },
  { name: 'AGGREGATE_RESULT', label: 'Aggregate result' },
];

type TimelineStepStatus = 'pending' | 'active' | 'done' | 'failed' | 'skipped';

interface LivePipelineProps {
  checkId: string;
  onComplete: (checkId: string) => void;
}

function getStepStatus(log: StepLog | undefined, currentStep: StepName | null, stepName: StepName): TimelineStepStatus {
  if (!log) {
    const isCurrentStep = currentStep === stepName;
    return isCurrentStep ? 'active' : 'pending';
  }

  if (log.status === 'COMPLETED') {
    return 'done';
  }

  if (log.status === 'FAILED') {
    return 'failed';
  }

  if (log.status === 'SKIPPED') {
    return 'skipped';
  }

  return 'active';
}

export function LivePipeline({ checkId, onComplete }: LivePipelineProps) {
  const [check, setCheck] = useState<Check | null>(null);
  const [logs, setLogs] = useState<StepLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const logsByStepName = useMemo(() => {
    return new Map(logs.map((log) => [log.stepName, log]));
  }, [logs]);

  useEffect(() => {
    const startedAtMs = Date.now();
    let isCancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function pollCheckStatus() {
      try {
        const [fetchedCheck, fetchedLogs] = await Promise.all([
          api.getCheck(checkId),
          api.getLogs(checkId).catch(() => []),
        ]);

        if (isCancelled) {
          return;
        }

        setError(null);
        setCheck(fetchedCheck);
        setLogs(fetchedLogs);
        setElapsedMs(Date.now() - startedAtMs);

        const isTerminalStatus = fetchedCheck.status === 'COMPLETED' || fetchedCheck.status === 'FAILED';
        if (isTerminalStatus) {
          timeoutId = setTimeout(() => onComplete(checkId), 600);
          return;
        }
      } catch {
        if (isCancelled) {
          return;
        }

        setError('Failed to fetch status. Retrying...');
        setElapsedMs(Date.now() - startedAtMs);
      }

      if (!isCancelled) {
        timeoutId = setTimeout(pollCheckStatus, 1500);
      }
    }

    pollCheckStatus();

    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [checkId, onComplete]);

  return (
    <div className="rounded-lg border border-border bg-surface p-8">
      <h1 className="mb-2 text-xl font-medium">Analyzing...</h1>
      <p className="mb-6 text-text-secondary">
        Elapsed: <span className="font-mono text-sm">{(elapsedMs / 1000).toFixed(1)}s</span>
      </p>

      <div className="space-y-1">
        {PIPELINE_STEPS.map((step) => {
          const log = logsByStepName.get(step.name);
          const status = getStepStatus(log, check?.currentStep ?? null, step.name);
          const isPendingStep = status === 'pending';

          return (
            <div key={step.name} className="flex items-center gap-3 border-b border-border-subtle py-2 last:border-0">
              <StepStatusIcon status={status} />
              <span className={`flex-1 text-sm ${isPendingStep ? 'text-text-tertiary' : 'text-text-primary'}`}>
                {step.label}
              </span>
              {log?.durationMs != null && <span className="font-mono text-xs text-text-tertiary">{log.durationMs}ms</span>}
            </div>
          );
        })}
      </div>

      {error && <div className="mt-4 text-sm text-risk-high">{error}</div>}
    </div>
  );
}

function StepStatusIcon({ status }: { status: TimelineStepStatus }) {
  if (status === 'done') {
    return <FiCheck className="h-4 w-4 text-risk-low" />;
  }

  if (status === 'failed') {
    return <FiX className="h-4 w-4 text-risk-high" />;
  }

  if (status === 'active') {
    return <FiLoader className="h-4 w-4 animate-spin text-info" />;
  }

  if (status === 'skipped') {
    return <span className="h-4 w-4 rounded-full border border-border-strong" />;
  }

  return <span className="h-4 w-4 rounded-full border border-border" />;
}
