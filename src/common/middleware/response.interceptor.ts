import {
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { LoggerService } from '../observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../observability/logger/nest-adapter/nest-logger.adapter';

export class ResponseInterceptor implements NestInterceptor {
  private readonly logger: LoggerService;

  /**
   * The container's `LoggerService` when one is registered — which is what
   * carries the trace id and the telemetry hook — and a `NestLoggerAdapter`
   * otherwise. `@Optional()` is what keeps `src/common/middleware/` liftable:
   * a project that copies it without `LoggerAbstractModule` still boots.
   */
  constructor(@Optional() @Inject(LoggerService) logger?: LoggerService) {
    this.logger = logger ?? new NestLoggerAdapter(ResponseInterceptor.name);
    this.logger.setContext(ResponseInterceptor.name);
  }

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => (data === undefined ? {} : data)),
      map((data) => {
        const req: Request = ctx.switchToHttp().getRequest();
        const res: Response = ctx.switchToHttp().getResponse();

        this.log(req, res);

        return data.data ||
          (res.getHeader('content-type') &&
            (res.getHeader('content-type') as string).includes('text/html'))
          ? data
          : { success: true, data };
      }),
    );
  }

  private log(req: Request, res: Response): void {
    const { method, url, ip, user } = req;
    const { statusCode } = res;

    // Rule 2 of the logger guide: values go in `data`, not interpolated into
    // the message, or the line stops being machine-parseable.
    this.logger.log({
      message: 'request handled',
      data: { method, url, statusCode, ip, userId: user ? user.id : null },
    });
  }
}
