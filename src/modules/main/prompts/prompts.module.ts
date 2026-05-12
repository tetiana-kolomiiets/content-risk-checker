import { Module } from '@nestjs/common';
import { PROMPTS_REPOSITORY } from '../../../infrastructure/postgres/ports/prompts.repository';
import { PrismaModule } from '../../../infrastructure/postgres/client/prisma.module';
import { PrismaPromptsRepository } from '../../../infrastructure/postgres/repository/prisma-prompts.repository';
import { PromptsController } from './prompts.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PromptsController],
  providers: [
    {
      provide: PROMPTS_REPOSITORY,
      useClass: PrismaPromptsRepository,
    },
  ],
  exports: [PROMPTS_REPOSITORY],
})
export class PromptsModule {}
