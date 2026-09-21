import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Binds `ThrottlerGuard` to every route, the same way `MiddlewareModule`
 * binds the global interceptor and filter.
 *
 * The limits are not here: `ThrottlerModule.forRootAsync` in
 * `src/app.module.ts` builds them from `rateLimitScope`, and that module is
 * `@Global()`, so the guard resolves its options and storage wherever it is
 * registered. This module only says *that* the guard runs.
 *
 * Importing it without registering `ThrottlerModule` fails at startup rather
 * than silently leaving the API unlimited, which is the failure mode worth
 * having.
 */
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class RateLimitModule {}
