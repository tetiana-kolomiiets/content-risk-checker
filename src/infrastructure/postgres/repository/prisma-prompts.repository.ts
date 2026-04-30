import { Injectable } from '@nestjs/common';
import { PromptsRepository } from '../ports/prompts.repository';
import { PrismaService } from '../prisma/prisma.service';
import { toDomainPrompt } from './mappers/to-domain-prompt.mapper';
import {
  FAILED_TO_GET_ACTIVE_PROMPT_BY_NAME,
  FAILED_TO_GET_PROMPT_BY_ID,
} from './repository-error-messages';

@Injectable()
export class PrismaPromptsRepository implements PromptsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async getActiveByName(name: string) {
    try {
      const row = await this.prismaService.prompt.findFirst({
        where: { name, isActive: true },
        orderBy: { version: 'desc' },
      });

      return row ? toDomainPrompt(row) : null;
    } catch {
      return new Error(FAILED_TO_GET_ACTIVE_PROMPT_BY_NAME);
    }
  }

  async getById(id: string) {
    try {
      const row = await this.prismaService.prompt.findUnique({
        where: { id },
      });

      return row ? toDomainPrompt(row) : null;
    } catch {
      return new Error(FAILED_TO_GET_PROMPT_BY_ID);
    }
  }
}
