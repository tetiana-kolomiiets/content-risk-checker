import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ContentRiskCheckStatus } from '../../../domain/content-risk-checks/enums/content-risk-check-status.enum';
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
import {
  ContentRiskCheckIncludeField,
  GetContentRiskCheckDto,
} from './dto/get-content-risk-check.dto';
import { GetContentRiskChecksOutputDto } from './dto/get-content-risk-checks-output.dto';
import { contentRiskCheckToDto } from './mappers/content-risk-check-to-dto.mapper';
import { contentRiskStepLogToDto } from './mappers/content-risk-step-log-to-dto.mapper';

const hasRawTextInclude = (
  include: ContentRiskCheckIncludeField[] | undefined,
): boolean => include?.includes(ContentRiskCheckIncludeField.RAW_TEXT) ?? false;

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

  async createCheck(input: {
    text: string;
    sourceType?: ContentRiskSourceType;
    traceId: string;
  }): Promise<ContentRiskCheckDto> {
    const contentHash = createHash('sha256').update(input.text).digest('hex');

    const activePrompt =
      await this.promptsRepo.getActiveByName(ACTIVE_PROMPT_NAME);
    if (!activePrompt) {
      throw new ServiceUnavailableException({
        code: 'NO_ACTIVE_PROMPT',
        message: 'No active prompt configured',
      });
    }

    const existing = await this.checksRepo.findActiveByContentHash(
      contentHash,
      activePrompt.id,
    );
    if (existing) {
      this.logger.info(
        { checkId: existing.id, idempotent_hit: true },
        'Returning existing completed check',
      );
      return contentRiskCheckToDto(existing);
    }

    const check = await this.checksRepo.create({
      rawText: input.text,
      contentHash,
      traceId: input.traceId,
      promptVersionId: activePrompt.id,
      sourceType: input.sourceType ?? ContentRiskSourceType.PLAIN_TEXT,
      requestId: randomUUID(),
      maxRetries: DEFAULT_MAX_RETRIES,
    });

    await this.analysisQueue.enqueue({
      checkId: check.id,
      traceId: input.traceId,
    });

    return contentRiskCheckToDto(check);
  }

  async replayCheck(
    originalId: string,
    traceId: string,
  ): Promise<ContentRiskCheckDto> {
    const original = await this.checksRepo.getById(originalId);
    if (!original) {
      throw new NotFoundException('Original check not found');
    }

    if (
      original.status !== ContentRiskCheckStatus.COMPLETED &&
      original.status !== ContentRiskCheckStatus.FAILED
    ) {
      throw new BadRequestException({
        code: 'INVALID_REPLAY_STATE',
        message: `Cannot replay check in status ${original.status}. Only COMPLETED or FAILED checks can be replayed.`,
      });
    }

    const activePrompt =
      await this.promptsRepo.getActiveByName(ACTIVE_PROMPT_NAME);
    if (!activePrompt) {
      throw new ServiceUnavailableException({
        code: 'NO_ACTIVE_PROMPT',
        message: 'No active prompt configured',
      });
    }

    const newCheck = await this.checksRepo.create({
      rawText: original.rawText,
      contentHash: original.contentHash,
      traceId,
      promptVersionId: activePrompt.id,
      replayOfCheckId: original.id,
      sourceType: original.sourceType,
      requestId: randomUUID(),
      maxRetries: DEFAULT_MAX_RETRIES,
    });

    await this.analysisQueue.enqueue({
      checkId: newCheck.id,
      traceId,
    });

    if (activePrompt.id !== original.promptVersionId) {
      this.logger.info(
        {
          replay_with_new_prompt: true,
          newCheckId: newCheck.id,
          originalCheckId: original.id,
          oldPromptVersion: original.promptVersionId,
          newPromptVersion: activePrompt.id,
        },
        'Replay with different prompt version',
      );
    }

    return contentRiskCheckToDto(newCheck);
  }

  async getCheckById(
    id: string,
    query: GetContentRiskCheckDto = {},
  ): Promise<ContentRiskCheckDto> {
    const check = await this.checksRepo.getById(id);

    if (check === null) {
      throw new NotFoundException('Check not found');
    }

    const analysisResult = await this.analysisResultsRepo.getByCheckId(
      check.id,
    );

    return contentRiskCheckToDto(check, analysisResult, {
      includeRawText: hasRawTextInclude(query.include),
    });
  }

  async getChecks(
    query: GetContentRiskCheckDto,
  ): Promise<GetContentRiskChecksOutputDto> {
    const checks = await this.checksRepo.getMany(query.status);
    const includeRawText = hasRawTextInclude(query.include);

    return {
      items: checks.map((check) =>
        contentRiskCheckToDto(check, undefined, { includeRawText }),
      ),
    };
  }

  async getStepLogs(checkId: string): Promise<ContentRiskStepLogDto[]> {
    const check = await this.checksRepo.getById(checkId);

    if (check === null) {
      throw new NotFoundException('Check not found');
    }

    const logs = await this.stepLogsRepo.getByCheckId(checkId);

    return logs.map(contentRiskStepLogToDto);
  }
}
