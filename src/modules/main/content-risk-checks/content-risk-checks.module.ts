import { Module } from '@nestjs/common';
import { EmbeddingModule } from '../../../infrastructure/embedding/embedding.module';
import { AI_ANALYSIS_MEMORY_REPOSITORY } from '../../../infrastructure/postgres/ports/ai-analysis-memory.repository';
import { CONTENT_RISK_ANALYSIS_RESULTS_REPOSITORY } from '../../../infrastructure/postgres/ports/content-risk-analysis-results.repository';
import { CONTENT_RISK_CHECKS_REPOSITORY } from '../../../infrastructure/postgres/ports/content-risk-checks.repository';
import { CONTENT_RISK_STEP_LOGS_REPOSITORY } from '../../../infrastructure/postgres/ports/content-risk-step-logs.repository';
import { PrismaModule } from '../../../infrastructure/postgres/prisma/prisma.module';
import { PrismaAiAnalysisMemoryRepository } from '../../../infrastructure/postgres/repository/prisma-ai-analysis-memory.repository';
import { PrismaContentRiskAnalysisResultsRepository } from '../../../infrastructure/postgres/repository/prisma-content-risk-analysis-results.repository';
import { PrismaContentRiskChecksRepository } from '../../../infrastructure/postgres/repository/prisma-content-risk-checks.repository';
import { PrismaContentRiskStepLogsRepository } from '../../../infrastructure/postgres/repository/prisma-content-risk-step-logs.repository';
import { PromptsModule } from '../prompts/prompts.module';
import { QueueModule } from '../../queue/queue.module';
import { AnalysisQueue } from './analysis.queue';
import { ContentRiskChecksController } from './content-risk-checks.controller';
import { ContentRiskChecksPipelineService } from './content-risk-checks-pipeline.service';
import { ContentRiskChecksProcessor } from './content-risk-checks.processor';
import { ContentRiskChecksService } from './content-risk-checks.service';
import { AggregateResultStep } from './pipeline/steps/aggregate-result.step';
import { AiAnalysisStep } from './pipeline/steps/ai-analysis.step';
import { DetectDuplicateStep } from './pipeline/steps/detect-duplicate.step';
import { NormalizeTextStep } from './pipeline/steps/normalize-text.step';
import { PersistAiMemoryStep } from './pipeline/steps/persist-ai-memory.step';
import { RetrieveAiContextStep } from './pipeline/steps/retrieve-ai-context.step';
import { RuleBasedScanStep } from './pipeline/steps/rule-based-scan.step';

const runWorker = process.env.DISABLE_WORKER !== 'true';

@Module({
  imports: [PrismaModule, QueueModule, PromptsModule, EmbeddingModule],
  controllers: [ContentRiskChecksController],
  providers: [
    ContentRiskChecksService,
    ContentRiskChecksPipelineService,
    AnalysisQueue,
    NormalizeTextStep,
    DetectDuplicateStep,
    RuleBasedScanStep,
    RetrieveAiContextStep,
    AiAnalysisStep,
    AggregateResultStep,
    PersistAiMemoryStep,
    ...(runWorker ? [ContentRiskChecksProcessor] : []),
    {
      provide: CONTENT_RISK_CHECKS_REPOSITORY,
      useClass: PrismaContentRiskChecksRepository,
    },
    {
      provide: CONTENT_RISK_ANALYSIS_RESULTS_REPOSITORY,
      useClass: PrismaContentRiskAnalysisResultsRepository,
    },
    {
      provide: CONTENT_RISK_STEP_LOGS_REPOSITORY,
      useClass: PrismaContentRiskStepLogsRepository,
    },
    {
      provide: AI_ANALYSIS_MEMORY_REPOSITORY,
      useClass: PrismaAiAnalysisMemoryRepository,
    },
  ],
})
export class ContentRiskChecksModule {}
