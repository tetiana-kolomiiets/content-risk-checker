import { useCallback, useEffect, useState } from 'react';
import { FiAlertCircle, FiChevronDown, FiCopy, FiRotateCcw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import type { Check, CheckStatus, StepLog } from '@/lib/types';
import { MetadataPanel } from './MetadataPanel';
import { PipelineTimeline } from './PipelineTimeline';
import { RiskHero } from './RiskHero';
import { useToast } from '../ui/toast-context';

interface CheckDetailProps {
  checkId: string;
  onCheckLoaded?: (check: Check) => void;
}

export function CheckDetail({ checkId, onCheckLoaded }: CheckDetailProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [check, setCheck] = useState<Check | null>(null);
  const [logs, setLogs] = useState<StepLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isInitialLoad = true;

    async function fetchCheck() {
      if (isInitialLoad) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const [fetchedCheck, fetchedLogs] = await Promise.all([
          api.getCheck(checkId),
          api.getLogs(checkId).catch(() => []),
        ]);

        if (isCancelled) {
          return;
        }

        setCheck(fetchedCheck);
        setLogs(fetchedLogs);
        onCheckLoaded?.(fetchedCheck);

        const isTerminal = fetchedCheck.status === 'COMPLETED' || fetchedCheck.status === 'FAILED';
        if (!isTerminal) {
          timeoutId = setTimeout(fetchCheck, 1500);
        }
      } catch {
        if (!isCancelled && isInitialLoad) {
          setError('Failed to load check');
        }
      } finally {
        if (!isCancelled && isInitialLoad) {
          setIsLoading(false);
          isInitialLoad = false;
        }
      }
    }

    fetchCheck();

    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [checkId, onCheckLoaded]);

  const onReplay = useCallback(async () => {
    if (!check || isReplaying) {
      return;
    }

    setIsReplaying(true);
    try {
      const newCheck = await api.replayCheck(check.id);
      navigate(`/checks/${newCheck.id}`);
    } catch {
      toast({ variant: 'error', message: 'Unable to replay this check right now.' });
      setIsReplaying(false);
    }
  }, [check, isReplaying, navigate, toast]);

  useEffect(() => {
    const canReplay = check?.status === 'COMPLETED' || check?.status === 'FAILED';
    if (!canReplay) {
      return;
    }

    function handleReplayShortcut(event: KeyboardEvent) {
      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (isEditableTarget) {
        return;
      }

      const isReplayShortcut = event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (isReplayShortcut) {
        event.preventDefault();
        void onReplay();
      }
    }

    window.addEventListener('keydown', handleReplayShortcut);
    return () => {
      window.removeEventListener('keydown', handleReplayShortcut);
    };
  }, [check?.status, onReplay]);

  if (isLoading) {
    return <div className="text-text-tertiary">Loading...</div>;
  }

  if (error) {
    return <div className="text-risk-high">{error}</div>;
  }

  if (!check) {
    return <div className="text-text-tertiary">Check not found</div>;
  }

  const result = check.analysisResult ?? null;
  const totalDurationMs =
    check.startedAt && check.finishedAt
      ? new Date(check.finishedAt).getTime() - new Date(check.startedAt).getTime()
      : null;
  const hasResult = result != null;
  const hasRationale = Boolean(result?.summary);
  const hasFlaggedContent = (result?.flaggedFragments.length ?? 0) > 0;
  const canReplay = check.status === 'COMPLETED' || check.status === 'FAILED';

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
        <code className="text-sm font-mono text-text-secondary">{check.id}</code>
        <StatusBadge status={check.status} />
        {totalDurationMs != null && (
          <span className="ml-auto text-sm font-mono text-text-tertiary">{formatDuration(totalDurationMs)}</span>
        )}
      </div>

      {check.status === 'FAILED' && (
        <div className="border-b border-risk-high/20 bg-risk-high/5 p-6">
          <div className="flex items-start gap-3">
            <FiAlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-risk-high" />
            <div>
              <div className="font-medium text-risk-high">Pipeline failed</div>
              <div className="mt-1 text-sm text-text-secondary">See the failed step below for details.</div>
            </div>
          </div>
        </div>
      )}

      {hasResult && <RiskHero result={result} />}

      {check.rawText && <OriginalContent rawText={check.rawText} />}

      {hasRationale && (
        <div className="border-t border-border px-6 py-4">
          <div className="mb-2 text-sm font-medium text-text-secondary">AI rationale</div>
          <blockquote className="border-l-2 border-border-strong pl-3 text-sm italic text-text-primary">
            {result?.summary}
          </blockquote>
        </div>
      )}

      {hasFlaggedContent && (
        <div className="border-t border-border px-6 py-4">
          <div className="mb-2 text-sm font-medium text-text-secondary">Flagged content</div>
          <div className="space-y-1.5">
            {result?.flaggedFragments.map((fragment, index) => (
              <div key={`${fragment.text}-${index}`} className="flex items-start gap-3 text-sm">
                <code className="rounded bg-risk-high/10 px-1.5 py-0.5 font-mono text-xs text-risk-high">
                  "{fragment.text}"
                </code>
                <span className="text-text-secondary">{fragment.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border px-6 py-4">
        <div className="mb-3 text-sm font-medium text-text-secondary">Pipeline</div>
        <PipelineTimeline logs={logs} />
      </div>

      <div className="border-t border-border px-6 py-4">
        <div className="mb-3 text-sm font-medium text-text-secondary">Metadata & tracing</div>
        <MetadataPanel check={check} />
      </div>

      <div className="flex gap-2 border-t border-border px-6 py-4">
        {canReplay && (
          <button
            type="button"
            onClick={onReplay}
            disabled={isReplaying}
            className="flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            <FiRotateCcw className="h-4 w-4" />
            {isReplaying ? 'Replaying...' : 'Replay with current prompt'}
          </button>
        )}

        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(check.id)}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:border-border-strong"
        >
          <FiCopy className="h-4 w-4" />
          Copy ID
        </button>
      </div>
    </div>
  );
}

const PREVIEW_CHAR_LIMIT = 280;
const PREVIEW_LINE_LIMIT = 5;

function OriginalContent({ rawText }: { rawText: string }) {
  const [expanded, setExpanded] = useState(false);
  const lineCount = rawText.split('\n').length;
  const isLong = rawText.length > PREVIEW_CHAR_LIMIT || lineCount > PREVIEW_LINE_LIMIT;

  const preview =
    isLong && !expanded
      ? rawText.split('\n').slice(0, PREVIEW_LINE_LIMIT).join('\n').slice(0, PREVIEW_CHAR_LIMIT)
      : rawText;

  return (
    <div className="border-t border-border px-6 py-4">
      <div className="mb-2 text-sm font-medium text-text-secondary">Original content</div>
      <pre className="whitespace-pre-wrap break-words rounded border border-border-subtle bg-bg p-3 font-mono text-sm text-text-primary">
        {preview}
        {isLong && !expanded && <span className="text-text-tertiary">…</span>}
      </pre>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
        >
          <FiChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? 'Hide' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === 'COMPLETED') {
    return <Badge variant="low">Completed</Badge>;
  }
  if (status === 'FAILED') {
    return <Badge variant="high">Failed</Badge>;
  }
  if (status === 'PROCESSING') {
    return <Badge variant="info">Processing</Badge>;
  }
  if (status === 'PENDING') {
    return <Badge variant="neutral">Pending</Badge>;
  }
  return <Badge variant="neutral">{status.toLowerCase()}</Badge>;
}
