import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../../../../config/env.schema';
import { ContentRiskStepName } from '../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { AiFewShotExample } from '../../../../../domain/content-risk-checks/types/ai-few-shot-example.type';
import {
  EMBEDDING_CLIENT,
  EmbeddingClient,
  EmbeddingError,
} from '../../../../../infrastructure/embedding/embedding-client.port';
import {
  AI_ANALYSIS_MEMORY_REPOSITORY,
  AiAnalysisMemoryRepository,
} from '../../../../../infrastructure/postgres/ports/ai-analysis-memory.repository';
import { PipelineStep } from '../contracts/pipeline-step.interface';
import { StepContext } from '../contracts/step-context.type';
import { StepResult } from '../contracts/step-result.type';

interface RetrieveContextInput {
  normalizedText: string;
  selfId: string;
}

interface RetrieveContextOutput {
  examples: AiFewShotExample[];
  embedding: number[];
  embeddingModel: string;
}

@Injectable()
export class RetrieveAiContextStep implements PipelineStep<
  RetrieveContextInput,
  RetrieveContextOutput
> {
  readonly name = ContentRiskStepName.RETRIEVE_AI_CONTEXT;

  constructor(
    @Inject(EMBEDDING_CLIENT) private readonly embeddingClient: EmbeddingClient,
    @Inject(AI_ANALYSIS_MEMORY_REPOSITORY)
    private readonly memoryRepo: AiAnalysisMemoryRepository,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async execute(
    input: RetrieveContextInput,
    _ctx: StepContext,
  ): Promise<StepResult<RetrieveContextOutput>> {
    const enabled = this.config.get('AI_MEMORY_ENABLED', { infer: true });
    const model = this.config.get('AI_EMBEDDING_MODEL', { infer: true });

    if (!enabled) {
      return this.success(
        { examples: [], embedding: [], embeddingModel: model },
        {
          stepName: this.name,
          enabled: false,
          examplesFound: 0,
        },
      );
    }

    const embedding = await this.embeddingClient.embed(input.normalizedText);
    if (embedding instanceof EmbeddingError) {
      return this.success(
        { examples: [], embedding: [], embeddingModel: model },
        {
          stepName: this.name,
          enabled: true,
          examplesFound: 0,
          embeddingErrorCode: embedding.code,
          embeddingErrorMessage: embedding.message,
        },
      );
    }

    const topN = this.config.get('AI_MEMORY_TOP_N', { infer: true });
    const minSimilarity = this.config.get('AI_MEMORY_MIN_SIMILARITY', {
      infer: true,
    });

    const examples = await this.memoryRepo.findSimilar(
      embedding,
      _ctx.promptVersionId,
      {
        topN,
        minSimilarity,
        excludeCheckId: input.selfId,
      },
    );
    if (examples instanceof Error) {
      return this.success(
        { examples: [], embedding, embeddingModel: model },
        {
          stepName: this.name,
          enabled: true,
          examplesFound: 0,
          repoErrorMessage: examples.message,
        },
      );
    }

    const avgSimilarity = examples.length
      ? examples.reduce((s, e) => s + e.similarity, 0) / examples.length
      : 0;

    return this.success(
      { examples, embedding, embeddingModel: model },
      {
        stepName: this.name,
        enabled: true,
        examplesFound: examples.length,
        avgSimilarity,
        topSimilarity: examples[0]?.similarity ?? 0,
      },
    );
  }

  private success(
    output: RetrieveContextOutput,
    details: {
      stepName: ContentRiskStepName.RETRIEVE_AI_CONTEXT;
      enabled: boolean;
      examplesFound: number;
      avgSimilarity?: number;
      topSimilarity?: number;
      embeddingErrorCode?: string;
      embeddingErrorMessage?: string;
      repoErrorMessage?: string;
    },
  ): StepResult<RetrieveContextOutput> {
    return { ok: true, output, details };
  }
}
