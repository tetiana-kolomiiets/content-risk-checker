import { Prompt } from '../../../domain/content-risk-checks/types/prompt.type';

export const PROMPTS_REPOSITORY = 'PROMPTS_REPOSITORY';

export interface PromptsRepository {
  getActiveByName(name: string): Promise<Prompt | null | Error>;

  getById(id: string): Promise<Prompt | null | Error>;
}
