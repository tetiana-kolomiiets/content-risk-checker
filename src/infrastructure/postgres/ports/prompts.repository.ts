import { Prompt } from '../../../domain/content-risk-checks/types/prompt.type';

export interface PromptsRepository {
  getActiveByName(name: string): Promise<Prompt | null | Error>;

  getById(id: string): Promise<Prompt | null | Error>;
}
