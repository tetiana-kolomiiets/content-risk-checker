interface OnboardingModalProps {
  isOpen: boolean;
  onConfirm: () => void;
}

export function OnboardingModal({ isOpen, onConfirm }: OnboardingModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-text-primary/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-[22px] font-medium text-text-primary">Welcome to Content Risk Checker</h2>
        <p className="mt-3 text-sm text-text-secondary">
          Submit any text and watch the 6-step pipeline analyze it for risk. Every decision is auditable,
          replayable, and includes the AI&apos;s reasoning.
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-6 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
