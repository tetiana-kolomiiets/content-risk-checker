import { Module } from '@nestjs/common';
import { AI_ANALYSIS_MEMORY_REPOSITORY } from '../../../infrastructure/postgres/ports/ai-analysis-memory.repository';
import { PrismaModule } from '../../../infrastructure/postgres/prisma/prisma.module';
import { PrismaAiAnalysisMemoryRepository } from '../../../infrastructure/postgres/repository/prisma-ai-analysis-memory.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: AI_ANALYSIS_MEMORY_REPOSITORY,
      useClass: PrismaAiAnalysisMemoryRepository,
    },
  ],
  exports: [AI_ANALYSIS_MEMORY_REPOSITORY],
})
export class AiMemoryModule {}
