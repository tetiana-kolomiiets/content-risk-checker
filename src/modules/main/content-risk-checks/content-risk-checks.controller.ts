import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TraceContext } from '../../../common/tracing/trace-context';
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

  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get(':id')
  @ApiOperation({ summary: 'Get content risk check by id' })
  @ApiOkResponse({ type: ContentRiskCheckDto })
  @ApiNotFoundResponse({ description: 'Check not found' })
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetContentRiskCheckDto,
  ): Promise<ContentRiskCheckDto> {
    return this.service.getCheckById(id, query);
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

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post()
  @HttpCode(202)
  @ApiOperation({ summary: 'Submit text for risk analysis' })
  @ApiAcceptedResponse({ type: ContentRiskCheckDto })
  async create(
    @Body() dto: CreateContentRiskCheckDto,
  ): Promise<ContentRiskCheckDto> {
    const traceId = TraceContext.get() ?? randomUUID();
    return this.service.createCheck({
      text: dto.text,
      sourceType: dto.sourceType,
      traceId,
    });
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post(':id/replay')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Replay an existing check with current active prompt',
  })
  @ApiAcceptedResponse({ type: ContentRiskCheckDto })
  @ApiNotFoundResponse({ description: 'Original check not found' })
  async replay(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContentRiskCheckDto> {
    const traceId = TraceContext.get() ?? randomUUID();
    return this.service.replayCheck(id, traceId);
  }
}
