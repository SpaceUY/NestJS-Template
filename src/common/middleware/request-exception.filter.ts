import {
  ExceptionFilter,
  Catch,
  HttpException,
  ArgumentsHost,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class RequestExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter', { timestamp: true });

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const code = exception.getStatus();
    const msg = exception.getResponse();

    let obj;
    if (typeof msg === 'string') {
      obj = {
        success: false,
        statusCode: code,
        message: msg,
      };
    } else {
      obj = {
        success: false,
        ...msg,
      };
    }

    res.status(code).json(obj);
  }
}
