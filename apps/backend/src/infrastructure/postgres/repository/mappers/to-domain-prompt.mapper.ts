import type { Prompt as PrismaPrompt } from '../../../../../generated/prisma/client';
import type { Prompt } from '../../../../domain/content-risk-checks/types/prompt.type';

export const toDomainPrompt = (row: PrismaPrompt): Prompt => {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    template: row.template,
    model: row.model,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
};
