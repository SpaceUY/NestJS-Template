import { HttpStatus } from '@nestjs/common';
import { ExceptionInfo } from './core/ExceptionBase';

export type ExceptionInfoTemplate<T = Record<string, any>> = (
  params: T,
) => ExceptionInfo;

interface NestedExceptionRecord {
  [key: string]: NestedExceptionRecord | ExceptionInfo | ExceptionInfoTemplate;
}

export const Exceptions = {
  auth: {
    invalidPayload: {
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INVALID_PAYLOAD',
      errorMsg: 'Could not load auth payload',
    },
    alreadyExists: {
      httpStatus: HttpStatus.CONFLICT,
      errorCode: 'AUTH_EXISTING',
      errorMsg: 'A user with this email already exists',
    } as ExceptionInfo,
    invalidCredentials: {
      httpStatus: HttpStatus.UNAUTHORIZED,
      errorCode: 'AUTH_INVALID_CREDS',
      errorMsg: 'Invalid credentials were used. Please try again',
    } as ExceptionInfo,
    invalidNotLoggedEmail: {
      httpStatus: HttpStatus.BAD_REQUEST,
      errorCode: 'AUTH_INVALID_NOT_LOGGED_EMAIL',
      errorMsg:
        'Invalid, not register with email. Please try with auth method register',
    } as ExceptionInfo,
    invalidResetCode: {
      httpStatus: HttpStatus.BAD_REQUEST,
      errorCode: 'AUTH_INVALID_RESET_CODE',
      errorMsg: 'Invalid reset token. Please try again',
    } as ExceptionInfo,
  },
  database: {
    alreadyExists: (args: {
      entity: string;
      field: string;
      value: string;
    }) => ({
      httpStatus: HttpStatus.CONFLICT,
      errorCode: 'DB_EXISTING',
      errorMsg: `${args.entity} with ${args.field} ${args.value} already exists`,
    }),
  },
  generic: {
    internalServer: (args?: { msg?: string }) => ({
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMsg: args?.msg ? args.msg : 'Internal Server Error',
    }),
  },
};
