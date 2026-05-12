import type { ReactNode } from 'react';

type Variant = 'low' | 'medium' | 'high' | 'info' | 'neutral';

interface BadgeProps {
  variant: Variant;
  children: ReactNode;
}

const styles: Record<Variant, string> = {
  low: 'bg-risk-low/10 text-risk-low',
  medium: 'bg-risk-medium/10 text-risk-medium',
  high: 'bg-risk-high/10 text-risk-high',
  info: 'bg-info/10 text-info',
  neutral: 'bg-border-subtle text-text-secondary',
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
}
