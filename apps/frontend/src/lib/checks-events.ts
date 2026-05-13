import type { Check } from './types';

type CheckCreatedListener = (check: Check) => void;

const listeners = new Set<CheckCreatedListener>();

export const checksEvents = {
  onCreated(listener: CheckCreatedListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  emitCreated(check: Check): void {
    listeners.forEach((listener) => listener(check));
  },
};
