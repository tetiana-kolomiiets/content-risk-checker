import { Module } from '@nestjs/common';
import { ContentRiskChecksController } from './content-risk-checks.controller';
import { ContentRiskChecksPipelineService } from './content-risk-checks-pipeline.service';
import { ContentRiskChecksProcessor } from './content-risk-checks.processor';
import { ContentRiskChecksService } from './content-risk-checks.service';

@Module({
  controllers: [ContentRiskChecksController],
  providers: [
    ContentRiskChecksService,
    ContentRiskChecksProcessor,
    ContentRiskChecksPipelineService,
  ],
})
export class ContentRiskChecksModule {}
