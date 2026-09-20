import {
  ExceptionFilter,
  Catch,
  HttpException,
  HttpStatus,
  ArgumentsHost,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

type ErrorBody = {
  success: false;
  statusCode: number;
  message: string | string[];
};

/**
 * Catches everything, not only `HttpException`, so no failure reaches the
 * client through Nest's default handler with a body shaped differently from
 * this one.
 *
 * The response body is built field by field and never spread from an
 * exception's own payload: `getResponse()` carries whatever the thrower put
 * there, and on a 500 that is routinely internal detail (finding `C4`).
 */
@Catch()
export class RequestExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter', { timestamp: true });

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      res.status(statusCode).json({
        success: false,
        statusCode,
        message: this._messageOf(exception),
      } satisfies ErrorBody);
      return;
    }

    // Not an HttpException: the detail belongs in the log, never in the body.
    const req = ctx.getRequest<{ method?: string; url?: string }>();
    const kind = exception instanceof Error ? exception.name : typeof exception;
    this.logger.error(
      `Unhandled ${kind} on ${req?.method ?? '?'} ${req?.url ?? '?'}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    } satisfies ErrorBody);
  }

  /**
   * `getResponse()` is a string for `new HttpException('msg', status)` and an
   * object for the built-in exceptions and for `ValidationPipe`, whose
   * `message` is the array of validation failures clients rely on. Only that
   * one field is read; every other key stays server-side.
   */
  private _messageOf(exception: HttpException): string | string[] {
    const response = exception.getResponse();

    if (typeof response === 'string') return response;

    const message = (response as { message?: unknown }).message;

    if (typeof message === 'string') return message;
    if (
      Array.isArray(message) &&
      message.every((entry) => typeof entry === 'string')
    ) {
      return message as string[];
    }

    return exception.message;
  }
}
