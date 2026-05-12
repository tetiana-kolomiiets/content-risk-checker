export type Prompt = {
  id: string;
  name: string;
  version: number;
  template: string;
  model: string;
  isActive: boolean;
  createdAt: Date;
};
