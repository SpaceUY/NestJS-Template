import {
  NestInterceptor,
  Logger,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';

export class ResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ResponseInterceptor', {
    timestamp: true,
  });

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
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

    this.logger.log(
      `${ip} ${user ? 'user' : '-'} ${
        user ? user.id : '-'
      } [${new Date().toISOString()}] "${method} ${url} HTTP/1.0" ${statusCode}`,
    );
  }
}
