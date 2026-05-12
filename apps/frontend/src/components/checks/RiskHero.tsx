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

function categoryLabel(category: string): string {
  return category.toLowerCase().replace('_', ' ');
}

export function RiskHero({ result }: { result: AnalysisResult }) {
  const Icon = ICONS[result.finalRiskLevel];
  const colorClass = COLORS[result.finalRiskLevel];

  return (
    <div className="p-6">
      <div className={`inline-flex items-center gap-2 text-xl font-medium ${colorClass}`}>
        <Icon className="h-5 w-5" />
        {result.finalRiskLevel === 'LOW' && 'Low risk'}
        {result.finalRiskLevel === 'MEDIUM' && 'Medium risk'}
        {result.finalRiskLevel === 'HIGH' && 'High risk'}
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
