import {
  Controller,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PROMPTS_REPOSITORY,
  PromptsRepository,
} from '../../../infrastructure/postgres/ports/prompts.repository';
import { PrismaService } from '../../../infrastructure/postgres/client/prisma.service';

@ApiTags('prompts')
@Controller({ path: 'prompts', version: '1' })
export class PromptsController {
  constructor(
    @Inject(PROMPTS_REPOSITORY)
    private readonly promptsRepo: PromptsRepository,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':id/activate')
  @ApiOperation({
    summary: 'Activate a prompt version (deactivates others with same name)',
  })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ activated: string }> {
    const target = await this.prisma.prompt.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Prompt not found');

    await this.prisma.$transaction([
      this.prisma.prompt.updateMany({
        where: { name: target.name, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.prompt.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);

    this.promptsRepo.invalidateCache(target.name);
    return { activated: id };
  }
}
