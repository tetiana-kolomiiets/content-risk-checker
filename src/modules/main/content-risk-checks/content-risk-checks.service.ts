import { createHash, randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ContentRiskSourceType } from '../../../domain/content-risk-checks/enums/content-risk-source-type.enum';
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
import {
  PROMPTS_REPOSITORY,
  PromptsRepository,
} from '../../../infrastructure/postgres/ports/prompts.repository';
import { AnalysisQueue } from './analysis.queue';
import { ContentRiskCheckDto } from './dto/content-risk-check.dto';
import { ContentRiskStepLogDto } from './dto/content-risk-step-log.dto';
import { GetContentRiskCheckDto } from './dto/get-content-risk-check.dto';
import { GetContentRiskChecksOutputDto } from './dto/get-content-risk-checks-output.dto';
import { contentRiskCheckToDto } from './mappers/content-risk-check-to-dto.mapper';
import { contentRiskStepLogToDto } from './mappers/content-risk-step-log-to-dto.mapper';

const ACTIVE_PROMPT_NAME = 'content-risk-analysis';
const DEFAULT_MAX_RETRIES = 3;

@Injectable()
export class ContentRiskChecksService {
  constructor(
    @Inject(CONTENT_RISK_CHECKS_REPOSITORY)
    private readonly checksRepo: ContentRiskChecksRepository,
    @Inject(CONTENT_RISK_ANALYSIS_RESULTS_REPOSITORY)
    private readonly analysisResultsRepo: ContentRiskAnalysisResultsRepository,
    @Inject(CONTENT_RISK_STEP_LOGS_REPOSITORY)
    private readonly stepLogsRepo: ContentRiskStepLogsRepository,
    @Inject(PROMPTS_REPOSITORY)
    private readonly promptsRepo: PromptsRepository,
    private readonly analysisQueue: AnalysisQueue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ContentRiskChecksService.name);
  }

  // Idempotency strategy (defense in depth):
  // 1. Service-level fast-path: check for existing COMPLETED, return early if found.
  // 2. DB-level constraint: unique partial index on (contentHash, promptVersionId)
  //    WHERE status='COMPLETED' AND replayOfCheckId IS NULL.
  // 3. Pipeline-level: DetectDuplicate step copies the result from an earlier winner
  //    when its lookup catches a concurrent COMPLETED check first.
  // 4. Race fallback: if pipeline finalize hits the unique constraint (P2002),
  //    PipelineRunner copies the winner's analysis result and marks itself a replay.
  async createCheck(input: {
    text: string;
    sourceType?: ContentRiskSourceType;
    traceId: string;
  }): Promise<ContentRiskCheckDto> {
    const contentHash = createHash('sha256').update(input.text).digest('hex');

    const activePrompt = this.unwrap(
      await this.promptsRepo.getActiveByName(ACTIVE_PROMPT_NAME),
    );
    if (!activePrompt) {
      throw new ServiceUnavailableException({
        code: 'NO_ACTIVE_PROMPT',
        message: 'No active prompt configured',
      });
    }

    const existing = this.unwrap(
      await this.checksRepo.findActiveByContentHash(
        contentHash,
        activePrompt.id,
      ),
    );
    if (existing) {
      this.logger.info(
        { checkId: existing.id, idempotent_hit: true },
        'Returning existing completed check',
      );
      return contentRiskCheckToDto(existing);
    }

    const check = this.unwrap(
      await this.checksRepo.create({
        rawText: input.text,
        contentHash,
        traceId: input.traceId,
        promptVersionId: activePrompt.id,
        sourceType: input.sourceType ?? ContentRiskSourceType.PLAIN_TEXT,
        requestId: randomUUID(),
        maxRetries: DEFAULT_MAX_RETRIES,
      }),
    );

    await this.analysisQueue.enqueue({
      checkId: check.id,
      traceId: input.traceId,
    });

    return contentRiskCheckToDto(check);
  }

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
