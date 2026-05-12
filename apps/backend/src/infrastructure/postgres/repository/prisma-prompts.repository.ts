import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Prompt } from '../../../domain/content-risk-checks/types/prompt.type';
import { PromptsRepository } from '../ports/prompts.repository';
import { PrismaService } from '../client/prisma.service';
import { toDomainPrompt } from './mappers/to-domain-prompt.mapper';
import {
  FAILED_TO_GET_ACTIVE_PROMPT_BY_NAME,
  FAILED_TO_GET_PROMPT_BY_ID,
} from './repository-error-messages';
import { RepositoryError } from './repository-error';

const CACHE_TTL_MS = 10_000;

@Injectable()
export class PrismaPromptsRepository implements PromptsRepository {
  private readonly cache = new Map<
    string,
    { prompt: Prompt; expiresAt: number }
  >();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PrismaPromptsRepository.name);
  }

  async getActiveByName(name: string): Promise<Prompt | null> {
    const startedAt = Date.now();
    const cached = this.cache.get(name);
    if (cached && cached.expiresAt > startedAt) {
      this.logger.debug(
        { name, durationMs: Date.now() - startedAt, cache: 'hit' },
        'Active prompt cache hit',
      );
      return cached.prompt;
    }

    try {
      const row = await this.prismaService.prompt.findFirst({
        where: { name, isActive: true },
        orderBy: { version: 'desc' },
      });

      if (!row) {
        this.logger.debug(
          { name, durationMs: Date.now() - startedAt, cache: 'miss' },
          'Active prompt not found',
        );
        return null;
      }

      const prompt = toDomainPrompt(row);
      this.cache.set(name, {
        prompt,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      this.logger.debug(
        { name, durationMs: Date.now() - startedAt, cache: 'miss' },
        'Active prompt cache miss — loaded from DB',
      );
      return prompt;
    } catch (err) {
      throw new RepositoryError(
        FAILED_TO_GET_ACTIVE_PROMPT_BY_NAME,
        FAILED_TO_GET_ACTIVE_PROMPT_BY_NAME,
        err,
      );
    }
  }

  async getById(id: string): Promise<Prompt | null> {
    try {
      const row = await this.prismaService.prompt.findUnique({
        where: { id },
      });
      return row ? toDomainPrompt(row) : null;
    } catch (err) {
      throw new RepositoryError(
        FAILED_TO_GET_PROMPT_BY_ID,
        FAILED_TO_GET_PROMPT_BY_ID,
        err,
      );
    }
  }

  invalidateCache(name?: string): void {
    if (name) {
      this.cache.delete(name);
    } else {
      this.cache.clear();
    }
  }
}
