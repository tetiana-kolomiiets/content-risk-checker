import { Module } from '@nestjs/common';
import { CONTENT_RISK_ANALYSIS_RESULTS_REPOSITORY } from '../../../infrastructure/postgres/ports/content-risk-analysis-results.repository';
import { CONTENT_RISK_CHECKS_REPOSITORY } from '../../../infrastructure/postgres/ports/content-risk-checks.repository';
import { CONTENT_RISK_STEP_LOGS_REPOSITORY } from '../../../infrastructure/postgres/ports/content-risk-step-logs.repository';
import { PrismaModule } from '../../../infrastructure/postgres/prisma/prisma.module';
import { PrismaContentRiskAnalysisResultsRepository } from '../../../infrastructure/postgres/repository/prisma-content-risk-analysis-results.repository';
import { PrismaContentRiskChecksRepository } from '../../../infrastructure/postgres/repository/prisma-content-risk-checks.repository';
import { PrismaContentRiskStepLogsRepository } from '../../../infrastructure/postgres/repository/prisma-content-risk-step-logs.repository';
import { ContentRiskChecksController } from './content-risk-checks.controller';
import { ContentRiskChecksPipelineService } from './content-risk-checks-pipeline.service';
import { ContentRiskChecksProcessor } from './content-risk-checks.processor';
import { ContentRiskChecksService } from './content-risk-checks.service';
import { DetectDuplicateStep } from './pipeline/steps/detect-duplicate.step';
import { NormalizeTextStep } from './pipeline/steps/normalize-text.step';
import { RuleBasedScanStep } from './pipeline/steps/rule-based-scan.step';

@Module({
  imports: [PrismaModule],
  controllers: [ContentRiskChecksController],
  providers: [
    ContentRiskChecksService,
    ContentRiskChecksProcessor,
    ContentRiskChecksPipelineService,
    NormalizeTextStep,
    DetectDuplicateStep,
    RuleBasedScanStep,
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
  ],
})
export class ContentRiskChecksModule {}
