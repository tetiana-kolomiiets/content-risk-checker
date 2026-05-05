import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';

type ToastVariant = 'info' | 'error' | 'success';

interface ToastOptions {
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
  isExiting: boolean;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const MAX_VISIBLE_TOASTS = 3;
const EXIT_ANIMATION_MS = 220;
const DEFAULT_DURATION_MS = 4000;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timeoutMapRef = useRef<Map<string, number>>(new Map());

  const removeToast = useCallback((id: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));

    const timeoutId = timeoutMapRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutMapRef.current.delete(id);
    }
  }, []);

  const scheduleExit = useCallback(
    (id: string, duration: number) => {
      const timeoutId = window.setTimeout(() => {
        setItems((prevItems) =>
          prevItems.map((item) => (item.id === id ? { ...item, isExiting: true } : item)),
        );

        window.setTimeout(() => removeToast(id), EXIT_ANIMATION_MS);
      }, duration);

      timeoutMapRef.current.set(id, timeoutId);
    },
    [removeToast],
  );

  const toast = useCallback(
    ({ message, variant, duration }: ToastOptions) => {
      const toastId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const toastDuration = duration ?? DEFAULT_DURATION_MS;

      setItems((prevItems) => {
        const nextItems = [...prevItems, { id: toastId, message, variant, duration: toastDuration, isExiting: false }];
        const overflowCount = Math.max(0, nextItems.length - MAX_VISIBLE_TOASTS);
        const overflowToasts = nextItems.slice(0, overflowCount);

        overflowToasts.forEach((item) => removeToast(item.id));
        return nextItems.slice(overflowCount);
      });

      scheduleExit(toastId, toastDuration);
    },
    [removeToast, scheduleExit],
  );

  useEffect(() => {
    return () => {
      timeoutMapRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutMapRef.current.clear();
    };
  }, []);

  const contextValue = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const cardClass = getCardClass(item.variant);
  const textClass = getTextClass(item.variant);
  const Icon = getToastIcon(item.variant);
  const isExiting = item.isExiting;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex items-start gap-3 rounded-md border bg-surface px-3 py-2 shadow-sm transition-all duration-200 ${cardClass} ${
        isExiting ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${textClass}`} aria-hidden="true" />
      <p className={`flex-1 text-sm ${textClass}`}>{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="rounded p-1 text-text-tertiary transition-colors hover:bg-border-subtle hover:text-text-primary"
      >
        <FiX className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function getCardClass(variant: ToastVariant): string {
  if (variant === 'error') {
    return 'border-risk-high/30';
  }
  if (variant === 'success') {
    return 'border-risk-low/30';
  }
  return 'border-info/30';
}

function getTextClass(variant: ToastVariant): string {
  if (variant === 'error') {
    return 'text-risk-high';
  }
  if (variant === 'success') {
    return 'text-risk-low';
  }
  return 'text-info';
}

function getToastIcon(variant: ToastVariant) {
  if (variant === 'error') {
    return FiAlertCircle;
  }
  if (variant === 'success') {
    return FiCheckCircle;
  }
  return FiInfo;
}
