export type CheckStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED'
  | 'CANCELLED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type RiskCategory =
  | 'TOXICITY'
  | 'HARASSMENT'
  | 'HATE'
  | 'THREAT'
  | 'SELF_HARM'
  | 'SEXUAL_CONTENT'
  | 'SPAM'
  | 'SCAM'
  | 'MISINFORMATION';

export type StepName =
  | 'NORMALIZE_TEXT'
  | 'DETECT_DUPLICATE'
  | 'RUN_RULE_BASED_CHECKS'
  | 'RETRIEVE_AI_CONTEXT'
  | 'RUN_AI_ANALYSIS'
  | 'AGGREGATE_RESULT';

export type StepStatus = 'STARTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export type SourceType = 'PLAIN_TEXT' | 'COMMENT' | 'POST' | 'MESSAGE';

export interface FlaggedFragment {
  text: string;
  reason: string;
}

export interface AnalysisResult {
  finalRiskLevel: RiskLevel;
  categories: RiskCategory[];
  matchedRulesCount: number;
  totalRulesChecked: number;
  flaggedFragments: FlaggedFragment[];
  matchedRules: unknown;
  summary: string;
}

export interface Check {
  id: string;
  status: CheckStatus;
  rawText: string;
  contentHash: string;
  traceId: string;
  promptVersionId: string | null;
  replayOfCheckId: string | null;
  retryCount: number;
  maxRetries: number;
  sourceType: SourceType;
  currentStep: StepName | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  analysisResult?: AnalysisResult | null;
}

export interface StepLog {
  id: string;
  checkId: string;
  traceId: string;
  stepName: StepName;
  status: StepStatus;
  attempt: number;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  details: Record<string, unknown>;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  postgres: 'ok' | 'error';
  redis: 'ok' | 'error';
}

export interface ApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  meta: {
    traceId: string;
    apiVersion: string;
    timestamp: string;
  };
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public traceId: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
