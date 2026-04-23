import { Controller } from '@nestjs/common';
import { ContentRiskChecksService } from './content-risk-checks.service';

@Controller({ path: 'content-risk-checks', version: '1' })
export class ContentRiskChecksController {
  constructor(
    private readonly contentRiskChecksService: ContentRiskChecksService,
  ) {}
}
