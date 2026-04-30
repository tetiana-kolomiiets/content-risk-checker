import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotImplementedException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ContentRiskChecksService } from './content-risk-checks.service';
import { ContentRiskCheckDto } from './dto/content-risk-check.dto';
import { ContentRiskStepLogDto } from './dto/content-risk-step-log.dto';
import { CreateContentRiskCheckDto } from './dto/create-content-risk-check.dto';
import { GetContentRiskCheckDto } from './dto/get-content-risk-check.dto';
import { GetContentRiskChecksOutputDto } from './dto/get-content-risk-checks-output.dto';

@ApiTags('content-risk-checks')
@Controller({ path: 'content-risk-checks', version: '1' })
export class ContentRiskChecksController {
  constructor(private readonly service: ContentRiskChecksService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get content risk check by id' })
  @ApiOkResponse({ type: ContentRiskCheckDto })
  @ApiNotFoundResponse({ description: 'Check not found' })
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContentRiskCheckDto> {
    return this.service.getCheckById(id);
  }

  @Get()
  @ApiOperation({ summary: 'List content risk checks' })
  async list(
    @Query() query: GetContentRiskCheckDto,
  ): Promise<GetContentRiskChecksOutputDto> {
    return this.service.getChecks(query);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get step execution logs for a check' })
  @ApiOkResponse({ type: ContentRiskStepLogDto, isArray: true })
  async getLogs(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContentRiskStepLogDto[]> {
    return this.service.getStepLogs(id);
  }

  @Post()
  @HttpCode(202)
  @ApiOperation({ summary: 'Submit text for risk analysis' })
  create(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body() dto: CreateContentRiskCheckDto,
  ): Promise<ContentRiskCheckDto> {
    throw new NotImplementedException();
  }

  @Post(':id/replay')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Replay an existing check with current active prompt',
  })
  replay(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContentRiskCheckDto> {
    throw new NotImplementedException();
  }
}
