import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Response } from 'express';
import { Logger } from 'nestjs-pino';
import { PipelineFailedError } from '../../modules/main/content-risk-checks/pipeline/contracts';
import { TraceContext } from '../tracing/trace-context';
import { ApiErrorResponse } from '../types/api-response';

interface MappedError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

const isThrottlerException = (exception: unknown): exception is HttpException =>
  exception instanceof HttpException &&
  exception.constructor.name === 'ThrottlerException';

const extractValidationDetails = (
  exception: BadRequestException,
): unknown => {
  const response = exception.getResponse();
  if (response && typeof response === 'object') {
    const message = (response as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message;
    }
    return response;
  }
  return undefined;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const mapped = this.mapException(exception);

    if (mapped.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        {
          err: exception,
          code: mapped.code,
          status: mapped.status,
        },
        mapped.message,
      );
    } else {
      this.logger.warn(
        {
          code: mapped.code,
          status: mapped.status,
        },
        mapped.message,
      );
    }

    const body: ApiErrorResponse = {
      data: null,
      error: {
        code: mapped.code,
        message: mapped.message,
        ...(mapped.details !== undefined ? { details: mapped.details } : {}),
      },
      meta: {
        traceId: TraceContext.get() ?? 'unknown',
        apiVersion: 'v1',
        timestamp: new Date().toISOString(),
      },
    };

    response.status(mapped.status).json(body);
  }

  private mapException(exception: unknown): MappedError {
    if (exception instanceof BadRequestException) {
      return {
        status: exception.getStatus(),
        code: 'VALIDATION_ERROR',
        message: exception.message,
        details: extractValidationDetails(exception),
      };
    }

    if (exception instanceof NotFoundException) {
      return {
        status: exception.getStatus(),
        code: 'NOT_FOUND',
        message: exception.message,
      };
    }

    if (exception instanceof ServiceUnavailableException) {
      const response = exception.getResponse();
      const ownCode =
        response && typeof response === 'object'
          ? (response as { code?: unknown }).code
          : undefined;
      return {
        status: exception.getStatus(),
        code: typeof ownCode === 'string' ? ownCode : 'SERVICE_UNAVAILABLE',
        message: exception.message,
      };
    }

    if (isThrottlerException(exception)) {
      return {
        status: exception.getStatus(),
        code: 'RATE_LIMITED',
        message: exception.message,
      };
    }

    if (exception instanceof PipelineFailedError) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'PIPELINE_FAILED',
        message: exception.message,
        details: {
          stepName: exception.stepName,
          errorCode: exception.errorCode,
        },
      };
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        response && typeof response === 'object'
          ? ((response as { message?: unknown }).message ?? exception.message)
          : exception.message;
      return {
        status: exception.getStatus(),
        code: 'HTTP_ERROR',
        message: typeof message === 'string' ? message : exception.message,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL',
      message: 'Internal server error',
    };
  }
}
