import { ContentRiskAnalysisResult } from '../../../../domain/content-risk-checks/types/content-risk-analysis-result.type';
import { ContentRiskCheck } from '../../../../domain/content-risk-checks/types/content-risk-check.type';
import { ContentRiskCheckDto } from '../dto/content-risk-check.dto';
import { contentRiskAnalysisResultToDto } from './content-risk-analysis-result-to-dto.mapper';

type Options = {
  includeRawText?: boolean;
};

export const contentRiskCheckToDto = (
  contentRiskCheck: ContentRiskCheck,
  analysisResult?: ContentRiskAnalysisResult | null,
  options: Options = {},
): ContentRiskCheckDto => {
  return {
    id: contentRiskCheck.id,
    requestId: contentRiskCheck.requestId,
    sourceType: contentRiskCheck.sourceType,
    status: contentRiskCheck.status,
    currentStep: contentRiskCheck.currentStep,
    contentHash: contentRiskCheck.contentHash,
    ...(options.includeRawText ? { rawText: contentRiskCheck.rawText } : {}),
    normalizedText: contentRiskCheck.normalizedText,
    errorMessage: contentRiskCheck.errorMessage,
    retryCount: contentRiskCheck.retryCount,
    maxRetries: contentRiskCheck.maxRetries,
    replayOfCheckId: contentRiskCheck.replayOfCheckId,
    duplicateOfCheckId: contentRiskCheck.duplicateOfCheckId,
    startedAt: contentRiskCheck.startedAt
      ? contentRiskCheck.startedAt.toISOString()
      : null,
    finishedAt: contentRiskCheck.finishedAt
      ? contentRiskCheck.finishedAt.toISOString()
      : null,
    createdAt: contentRiskCheck.createdAt.toISOString(),
    updatedAt: contentRiskCheck.updatedAt.toISOString(),
    analysisResult: analysisResult
      ? contentRiskAnalysisResultToDto(analysisResult)
      : analysisResult,
  };
};
