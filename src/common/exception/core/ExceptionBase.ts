import { HttpException, HttpStatus } from '@nestjs/common';

export interface ExceptionInfo {
  httpStatus: HttpStatus;
  errorCode: string;
  errorMsg: string;
}

export class RequestException extends HttpException {
  errorCode: string;

  constructor(exceptionInfo: ExceptionInfo) {
    super(exceptionInfo.errorMsg, exceptionInfo.httpStatus);
    this.errorCode = exceptionInfo.errorCode;
  }
}
