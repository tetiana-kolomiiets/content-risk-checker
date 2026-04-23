import { ContentRiskAnalysisResult } from '../../../../domain/content-risk-checks/types/content-risk-analysis-result.type';
import { ContentRiskCheck } from '../../../../domain/content-risk-checks/types/content-risk-check.type';
import { ContentRiskAnalysisResultDto } from '../dto/content-risk-analysis-result.dto';
import { ContentRiskCheckDto } from '../dto/content-risk-check.dto';
import { contentRiskAnalysisResultToDto } from './content-risk-analysis-result-to-dto.mapper';

const mapAnalysisResult = (
  analysisResult?: ContentRiskAnalysisResult | null,
): ContentRiskAnalysisResultDto | null | undefined => {
  if (analysisResult === undefined) {
    return undefined;
  }

  if (analysisResult === null) {
    return null;
  }

  return contentRiskAnalysisResultToDto(analysisResult);
};

export const contentRiskCheckToDto = (
  contentRiskCheck: ContentRiskCheck,
  analysisResult?: ContentRiskAnalysisResult | null,
): ContentRiskCheckDto => {
  return {
    id: contentRiskCheck.id,
    requestId: contentRiskCheck.requestId,
    sourceType: contentRiskCheck.sourceType,
    status: contentRiskCheck.status,
    currentStep: contentRiskCheck.currentStep,
    contentHash: contentRiskCheck.contentHash,
    rawText: contentRiskCheck.rawText,
    normalizedText: contentRiskCheck.normalizedText,
    errorMessage: contentRiskCheck.errorMessage,
    retryCount: contentRiskCheck.retryCount,
    maxRetries: contentRiskCheck.maxRetries,
    replayOfCheckId: contentRiskCheck.replayOfCheckId,
    startedAt: contentRiskCheck.startedAt,
    finishedAt: contentRiskCheck.finishedAt,
    createdAt: contentRiskCheck.createdAt,
    updatedAt: contentRiskCheck.updatedAt,
    analysisResult: mapAnalysisResult(analysisResult),
  };
};
