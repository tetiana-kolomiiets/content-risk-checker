import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { TraceContext } from './trace-context';

const TRACE_HEADER = 'x-trace-id';

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(TRACE_HEADER);
    const traceId =
      incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();

    res.setHeader(TRACE_HEADER, traceId);

    TraceContext.run(traceId, () => next());
  }
}
