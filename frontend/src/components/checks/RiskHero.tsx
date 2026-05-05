import { FiAlertCircle, FiAlertTriangle, FiCheck } from 'react-icons/fi';
import type { ComponentType } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { AnalysisResult, RiskLevel } from '@/lib/types';

const ICONS: Record<RiskLevel, ComponentType<{ className?: string }>> = {
  LOW: FiCheck,
  MEDIUM: FiAlertTriangle,
  HIGH: FiAlertCircle,
};

const COLORS: Record<RiskLevel, string> = {
  LOW: 'text-risk-low',
  MEDIUM: 'text-risk-medium',
  HIGH: 'text-risk-high',
};

const FILL_COLORS: Record<RiskLevel, string> = {
  LOW: 'bg-risk-low',
  MEDIUM: 'bg-risk-medium',
  HIGH: 'bg-risk-high',
};

function scoreToPercent(level: RiskLevel, matchedRulesCount: number, totalRulesChecked: number): number {
  if (totalRulesChecked === 0) {
    if (level === 'LOW') {
      return 15;
    }
    if (level === 'MEDIUM') {
      return 50;
    }
    return 85;
  }

  return Math.round((matchedRulesCount / totalRulesChecked) * 100);
}

function categoryLabel(category: string): string {
  return category.toLowerCase().replace('_', ' ');
}

export function RiskHero({ result }: { result: AnalysisResult }) {
  const Icon = ICONS[result.finalRiskLevel];
  const colorClass = COLORS[result.finalRiskLevel];
  const fillClass = FILL_COLORS[result.finalRiskLevel];
  const scorePercent = scoreToPercent(result.finalRiskLevel, result.matchedRulesCount, result.totalRulesChecked);

  return (
    <div className="p-6">
      <div className={`inline-flex items-center gap-2 text-xl font-medium ${colorClass}`}>
        <Icon className="h-5 w-5" />
        {result.finalRiskLevel === 'LOW' && 'Low risk'}
        {result.finalRiskLevel === 'MEDIUM' && 'Medium risk'}
        {result.finalRiskLevel === 'HIGH' && 'High risk'}
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-border-subtle">
        <div className={`h-full rounded-full transition-all ${fillClass}`} style={{ width: `${scorePercent}%` }} />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-xs text-text-secondary">
        <span>Score</span>
        <span className="font-mono">{scorePercent} / 100</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {result.categories.length === 0 ? (
          <span className="text-sm text-text-tertiary">No categories flagged</span>
        ) : (
          result.categories.map((category) => (
            <Badge key={category} variant="neutral">
              {categoryLabel(category)}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
