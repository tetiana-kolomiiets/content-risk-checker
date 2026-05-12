import { useState } from 'react';
import { FiAlertTriangle, FiCheck, FiCopy } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { formatDuration, formatRelativeTime } from '@/lib/format';
import type { Check } from '@/lib/types';

export function MetadataPanel({ check }: { check: Check }) {
  const isProcessing = check.status === 'PROCESSING';
  const retryHighlight: 'ok' | 'warn' | undefined =
    check.retryCount === 0
      ? undefined
      : check.retryCount === 1
        ? 'ok'
        : 'warn';

  const promptDisplay = check.promptVersion
    ? `${check.promptVersion.name}@v${check.promptVersion.version}`
    : check.promptVersionId ?? '—';

  const durationMs =
    check.startedAt && check.finishedAt
      ? new Date(check.finishedAt).getTime() -
        new Date(check.startedAt).getTime()
      : null;

  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
      <Section title="Identity" />
      <Row label="Status" value={check.status} mono />
      <Row label="Source" value={check.sourceType} mono />
      {isProcessing && check.currentStep && (
        <Row
          label="Current step"
          value={check.currentStep}
          mono
          highlight="info"
        />
      )}
      <Row label="Content hash" value={check.contentHash} mono copyable />

      <Section title="Pipeline" />
      <Row label="Prompt" value={promptDisplay} mono />
      <Row
        label="Retry count"
        value={`${check.retryCount} / ${check.maxRetries}`}
        highlight={retryHighlight}
      />
      {durationMs !== null && (
        <Row label="Duration" value={formatDuration(durationMs)} mono />
      )}

      <Section title="Timing" />
      <Row label="Created" value={check.createdAt} relativeDate />
      {check.startedAt && (
        <Row label="Started" value={check.startedAt} relativeDate />
      )}
      {check.finishedAt && (
        <Row label="Finished" value={check.finishedAt} relativeDate />
      )}

      <Section title="Tracing & relations" />
      <Row label="Trace ID" value={check.traceId} mono copyable />
      {check.replayOfCheckId && (
        <Row
          label="Replay of"
          value={check.replayOfCheckId}
          mono
          copyable
          linkTo={`/checks/${check.replayOfCheckId}`}
        />
      )}
      {check.duplicateOfCheckId && (
        <Row
          label="Duplicate of"
          value={check.duplicateOfCheckId}
          mono
          copyable
          linkTo={`/checks/${check.duplicateOfCheckId}`}
        />
      )}
    </dl>
  );
}

function Section({ title }: { title: string }) {
  return (
    <h3 className="col-span-2 mt-3 text-xs font-medium uppercase tracking-wide text-text-tertiary first:mt-0">
      {title}
    </h3>
  );
}

interface RowProps {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  linkTo?: string;
  relativeDate?: boolean;
  highlight?: 'warn' | 'info' | 'ok';
}

function Row({
  label,
  value,
  mono,
  copyable,
  linkTo,
  relativeDate,
  highlight,
}: RowProps) {
  const [isCopied, setIsCopied] = useState(false);

  function copyValue() {
    void navigator.clipboard.writeText(value);
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 2000);
  }

  const valueDisplay = relativeDate
    ? formatRelativeTime(value)
    : value;

  const tooltip = relativeDate ? new Date(value).toLocaleString() : undefined;

  const highlightClass =
    highlight === 'warn'
      ? 'text-risk-medium font-medium'
      : highlight === 'info'
        ? 'text-accent font-medium'
        : highlight === 'ok'
          ? 'text-risk-low font-medium'
          : '';

  return (
    <>
      <dt className="text-text-secondary">{label}</dt>
      <dd
        className={`flex items-center gap-2 ${mono ? 'font-mono text-xs' : ''} ${highlightClass}`}
        title={tooltip}
      >
        {highlight === 'warn' && (
          <FiAlertTriangle className="h-3 w-3 flex-shrink-0" />
        )}
        <span className="flex-1 break-all">
          {linkTo ? (
            <Link to={linkTo} className="text-accent hover:underline">
              {valueDisplay}
            </Link>
          ) : (
            valueDisplay
          )}
        </span>
        {copyable && (
          <button
            type="button"
            onClick={copyValue}
            className="flex-shrink-0 text-text-tertiary hover:text-text-primary"
            aria-label={`Copy ${label}`}
            title={`Copy ${label}`}
          >
            {isCopied ? (
              <FiCheck className="h-3 w-3 text-risk-low" />
            ) : (
              <FiCopy className="h-3 w-3" />
            )}
          </button>
        )}
      </dd>
    </>
  );
}
