import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { TraceContext } from '../tracing/trace-context';
import {
  ApiResponse,
  ApiSuccessResponse,
  isApiEnvelope,
} from '../types/api-response';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((value) => {
        if (isApiEnvelope(value)) {
          return value as ApiResponse<T>;
        }
        const wrapped: ApiSuccessResponse<T> = {
          data: value,
          error: null,
          meta: {
            traceId: TraceContext.get() ?? 'unknown',
            apiVersion: 'v1',
            timestamp: new Date().toISOString(),
          },
        };
        return wrapped;
      }),
    );
  }
}
