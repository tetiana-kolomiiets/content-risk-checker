import { useRef, useState } from 'react';
import { FiLoader, FiSend } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { checksEvents } from '@/lib/checks-events';
import { ApiError } from '@/lib/types';
import { LivePipeline } from './LivePipeline';

const QUICK_FILLS = [
  {
    label: 'Spam example',
    text: 'BUY NOW!!! click http://scam.tk/win-money fast guaranteed cash',
  },
  {
    label: 'Threat example',
    text: "I know where you live and I'm coming for you tonight, watch your back",
  },
  {
    label: 'Hate example',
    text: "These people are subhuman trash, they shouldn't be allowed in this country",
  },
  {
    label: 'Clean text',
    text: 'Anyone going to the park later? The weather looks lovely today.',
  },
];

interface NewCheckFormProps {
  hasExistingChecks: boolean;
}

export function NewCheckForm({ hasExistingChecks }: NewCheckFormProps) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [text, setText] = useState('');
  const [submittingCheckId, setSubmittingCheckId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasInputText = text.trim().length > 0;
  const canSubmitForm = hasInputText && !isSubmitting;
  const quickExamplesTitle = hasExistingChecks
    ? 'Try a quick example:'
    : 'Try one of the quick examples below to see how it works.';

  function handleTextareaKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const isSubmitShortcut = (event.metaKey || event.ctrlKey) && event.key === 'Enter';
    if (!isSubmitShortcut) {
      return;
    }

    event.preventDefault();
    formRef.current?.requestSubmit();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmitForm) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const trimmedText = text.trim();
      const check = await api.createCheck({ text: trimmedText });
      checksEvents.emitCreated({ ...check, rawText: check.rawText ?? trimmedText });
      setSubmittingCheckId(check.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError('Network error');
      }
      setIsSubmitting(false);
    }
  }

  function onComplete(checkId: string) {
    navigate(`/checks/${checkId}`);
  }

  if (submittingCheckId) {
    return <LivePipeline checkId={submittingCheckId} onComplete={onComplete} />;
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-8">
      <h1 className="mb-2 text-2xl font-medium">Analyze content for risk</h1>
      <p className="mb-6 text-text-secondary">
        Paste any text - forum post, comment, message - and the pipeline will analyze it across 8 risk
        categories.
      </p>

      <form ref={formRef} onSubmit={onSubmit}>
        <label htmlFor="new-check-text" className="mb-2 block text-sm text-text-secondary">
          Text to analyze
        </label>
        <textarea
          id="new-check-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleTextareaKeyDown}
          placeholder="Paste text here..."
          className="h-48 w-full resize-none rounded-md border border-border p-4 text-base focus:border-accent focus:shadow-focus focus:outline-none disabled:bg-border-subtle/40"
          maxLength={10000}
          disabled={isSubmitting}
        />

        <div className="mt-2 flex items-center justify-between text-sm text-text-tertiary">
          <span>{text.length} / 10000 characters</span>
          <span>Cmd+Enter to submit</span>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm text-text-secondary">{quickExamplesTitle}</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_FILLS.map((quickFill) => (
              <button
                key={quickFill.label}
                type="button"
                onClick={() => setText(quickFill.text)}
                disabled={isSubmitting}
                className="rounded-full border border-border px-3 py-1 text-sm text-text-secondary hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {quickFill.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-risk-high/20 bg-risk-high/5 p-3 text-sm text-risk-high">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmitForm}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSend className="h-4 w-4" />}
          {isSubmitting ? 'Submitting...' : 'Analyze'}
        </button>
      </form>
    </div>
  );
}
