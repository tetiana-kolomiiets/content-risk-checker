import { Injectable } from '@nestjs/common';
import { ContentRiskChecksPipelineService } from './content-risk-checks-pipeline.service';

@Injectable()
export class ContentRiskChecksService {
  constructor(
    private readonly contentRiskChecksPipelineService: ContentRiskChecksPipelineService,
  ) {}
}
