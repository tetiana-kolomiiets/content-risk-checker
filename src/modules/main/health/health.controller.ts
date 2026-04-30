import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { EnvConfig } from '../../../config/env.schema';
import { PrismaService } from '../../../infrastructure/postgres/prisma/prisma.service';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicators: HealthIndicatorService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    try {
      const result = await this.health.check([
        () => this.pingDatabase(),
        () => this.pingRedis(),
      ]);
      return this.toResponse(result);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw new ServiceUnavailableException(
          this.toResponse(error.getResponse() as HealthCheckResult),
        );
      }
      throw error;
    }
  }

  private async pingDatabase(): Promise<HealthIndicatorResult> {
    const indicator = this.indicators.check('db');
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: (error as Error).message });
    }
  }

  private async pingRedis(): Promise<HealthIndicatorResult> {
    const indicator = this.indicators.check('redis');
    const client = new Redis({
      host: this.config.get('REDIS_HOST', { infer: true }),
      port: this.config.get('REDIS_PORT', { infer: true }),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableOfflineQueue: false,
    });
    try {
      await client.connect();
      await client.ping();
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: (error as Error).message });
    } finally {
      client.disconnect();
    }
  }

  private toResponse(result: HealthCheckResult) {
    return {
      status: result.status,
      services: {
        db: result.details.db?.status ?? 'down',
        redis: result.details.redis?.status ?? 'down',
      },
    };
  }
}
