import { useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import type { Check } from '@/lib/types';

export function MetadataPanel({ check }: { check: Check }) {
  return (
    <div className="space-y-2 text-sm">
      <Row label="Trace ID" value={check.traceId} mono copyable />
      <Row label="Prompt version" value={check.promptVersionId ?? '—'} mono />
      <Row label="Created" value={new Date(check.createdAt).toLocaleString()} />
      {check.startedAt && <Row label="Started" value={new Date(check.startedAt).toLocaleString()} />}
      {check.finishedAt && <Row label="Finished" value={new Date(check.finishedAt).toLocaleString()} />}
      <Row label="Retry count" value={`${check.retryCount} / ${check.maxRetries}`} />
      {check.replayOfCheckId && (
        <Row label="Replay of" value={check.replayOfCheckId} mono linkTo={`/checks/${check.replayOfCheckId}`} />
      )}
      {check.duplicateOfCheckId && (
        <Row label="Duplicate of" value={check.duplicateOfCheckId} mono linkTo={`/checks/${check.duplicateOfCheckId}`} />
      )}
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  linkTo?: string;
}

function Row({ label, value, mono, copyable, linkTo }: RowProps) {
  const [isCopied, setIsCopied] = useState(false);

  function copyValue() {
    void navigator.clipboard.writeText(value);
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 1200);
  }

  return (
    <div className="flex items-baseline gap-3">
      <span className="w-32 flex-shrink-0 text-text-secondary">{label}</span>
      <span className={`flex-1 ${mono ? 'font-mono text-xs' : ''}`}>
        {linkTo ? (
          <Link to={linkTo} className="text-accent hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </span>
      {copyable && (
        <button
          type="button"
          onClick={copyValue}
          className="text-text-tertiary hover:text-text-primary"
          aria-label={`Copy ${label}`}
          title={`Copy ${label}`}
        >
          {isCopied ? <FiCheck className="h-3 w-3 text-risk-low" /> : <FiCopy className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}
