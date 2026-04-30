// TODO: remove this module after Prompt 10 — only registered in development
// to verify the response envelope and exception filter wiring.
import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';

@Module({
  controllers: [DebugController],
})
export class DebugModule {}
