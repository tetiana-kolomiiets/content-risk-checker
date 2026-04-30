import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CONTENT_RISK_ANALYSIS_RESULTS_REPOSITORY,
  ContentRiskAnalysisResultsRepository,
} from '../../../infrastructure/postgres/ports/content-risk-analysis-results.repository';
import {
  CONTENT_RISK_CHECKS_REPOSITORY,
  ContentRiskChecksRepository,
} from '../../../infrastructure/postgres/ports/content-risk-checks.repository';
import {
  CONTENT_RISK_STEP_LOGS_REPOSITORY,
  ContentRiskStepLogsRepository,
} from '../../../infrastructure/postgres/ports/content-risk-step-logs.repository';
import { ContentRiskChecksPipelineService } from './content-risk-checks-pipeline.service';
import { ContentRiskCheckDto } from './dto/content-risk-check.dto';
import { ContentRiskStepLogDto } from './dto/content-risk-step-log.dto';
import { GetContentRiskCheckDto } from './dto/get-content-risk-check.dto';
import { GetContentRiskChecksOutputDto } from './dto/get-content-risk-checks-output.dto';
import { contentRiskCheckToDto } from './mappers/content-risk-check-to-dto.mapper';
import { contentRiskStepLogToDto } from './mappers/content-risk-step-log-to-dto.mapper';

@Injectable()
export class ContentRiskChecksService {
  private readonly logger = new Logger(ContentRiskChecksService.name);

  constructor(
    @Inject(CONTENT_RISK_CHECKS_REPOSITORY)
    private readonly checksRepo: ContentRiskChecksRepository,
    @Inject(CONTENT_RISK_ANALYSIS_RESULTS_REPOSITORY)
    private readonly analysisResultsRepo: ContentRiskAnalysisResultsRepository,
    @Inject(CONTENT_RISK_STEP_LOGS_REPOSITORY)
    private readonly stepLogsRepo: ContentRiskStepLogsRepository,
    private readonly contentRiskChecksPipelineService: ContentRiskChecksPipelineService,
  ) {}

  async getCheckById(id: string): Promise<ContentRiskCheckDto> {
    const check = this.unwrap(await this.checksRepo.getById(id));

    if (check === null) {
      throw new NotFoundException('Check not found');
    }

    const analysisResult = this.unwrap(
      await this.analysisResultsRepo.getByCheckId(check.id),
    );

    return contentRiskCheckToDto(check, analysisResult);
  }

  async getChecks(
    query: GetContentRiskCheckDto,
  ): Promise<GetContentRiskChecksOutputDto> {
    const checks = this.unwrap(await this.checksRepo.getMany(query.status));

    return { items: checks.map((check) => contentRiskCheckToDto(check)) };
  }

  async getStepLogs(checkId: string): Promise<ContentRiskStepLogDto[]> {
    const check = this.unwrap(await this.checksRepo.getById(checkId));

    if (check === null) {
      throw new NotFoundException('Check not found');
    }

    const logs = this.unwrap(await this.stepLogsRepo.getByCheckId(checkId));

    return logs.map(contentRiskStepLogToDto);
  }

  private unwrap<T>(result: T | Error): T {
    if (result instanceof Error) {
      this.logger.error({ err: result }, 'Repository error');
      throw new InternalServerErrorException('Database error');
    }
    return result;
  }
}
