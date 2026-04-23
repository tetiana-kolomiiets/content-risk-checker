import { Injectable } from '@nestjs/common';
import { ContentRiskChecksService } from './content-risk-checks.service';

@Injectable()
export class ContentRiskChecksProcessor {
  constructor(
    private readonly contentRiskChecksService: ContentRiskChecksService,
  ) {}
}
