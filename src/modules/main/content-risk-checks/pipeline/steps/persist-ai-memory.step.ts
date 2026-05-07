import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import type { EnvConfig } from '../../../../../config/env.schema';
import { ContentRiskCategory } from '../../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../../../domain/content-risk-checks/enums/content-risk-level.enum';
import { ContentRiskStepName } from '../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import {
  AI_ANALYSIS_MEMORY_REPOSITORY,
  AiAnalysisMemoryRepository,
} from '../../../../../infrastructure/postgres/ports/ai-analysis-memory.repository';
import { PipelineStep } from '../contracts/pipeline-step.interface';
import { StepContext } from '../contracts/step-context.type';
import { StepResult } from '../contracts/step-result.type';

interface PersistAiMemoryInput {
  contentHash: string;
  normalizedText: string;
  embedding: number[];
  embeddingModel: string;
  finalRiskLevel: ContentRiskLevel;
  categories: ContentRiskCategory[];
  rationale: string;
}

type SkipReason = 'DISABLED' | 'NO_EMBEDDING' | 'REPO_ERROR';

interface PersistAiMemoryOutput {
  persisted: boolean;
  skipReason?: SkipReason;
}

const SNIPPET_MAX_LEN = 200;

@Injectable()
export class PersistAiMemoryStep implements PipelineStep<
  PersistAiMemoryInput,
  PersistAiMemoryOutput
> {
  readonly name = ContentRiskStepName.PERSIST_AI_MEMORY;

  constructor(
    @Inject(AI_ANALYSIS_MEMORY_REPOSITORY)
    private readonly memoryRepo: AiAnalysisMemoryRepository,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext('PersistAiMemoryStep');
  }

  async execute(
    input: PersistAiMemoryInput,
    ctx: StepContext,
  ): Promise<StepResult<PersistAiMemoryOutput>> {
    const enabled = this.config.get('AI_MEMORY_ENABLED', { infer: true });
    if (!enabled) {
      return this.skipped('DISABLED');
    }

    if (input.embedding.length === 0) {
      return this.skipped('NO_EMBEDDING');
    }

    const created = await this.memoryRepo.create({
      checkId: ctx.checkId,
      embedding: input.embedding,
      embeddingModel: input.embeddingModel,
      contentSnippet: input.normalizedText.slice(0, SNIPPET_MAX_LEN),
      contentHash: input.contentHash,
      finalRiskLevel: input.finalRiskLevel,
      categories: input.categories,
      rationale: input.rationale,
      promptVersionId: ctx.promptVersionId,
    });

    if (created instanceof Error) {
      this.logger.warn(
        {
          checkId: ctx.checkId,
          traceId: ctx.traceId,
          error: created.message,
        },
        'Failed to persist AI memory — non-fatal',
      );
      return {
        ok: true,
        output: { persisted: false, skipReason: 'REPO_ERROR' },
        details: {
          stepName: ContentRiskStepName.PERSIST_AI_MEMORY,
          persisted: false,
          skipReason: 'REPO_ERROR',
          errorMessage: created.message,
        },
      };
    }

    return {
      ok: true,
      output: { persisted: true },
      details: {
        stepName: ContentRiskStepName.PERSIST_AI_MEMORY,
        persisted: true,
      },
    };
  }

  private skipped(reason: SkipReason): StepResult<PersistAiMemoryOutput> {
    return {
      ok: true,
      output: { persisted: false, skipReason: reason },
      details: {
        stepName: ContentRiskStepName.PERSIST_AI_MEMORY,
        persisted: false,
        skipReason: reason,
      },
    };
  }
}
