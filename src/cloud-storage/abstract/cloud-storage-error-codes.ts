import { HttpStatus } from '@nestjs/common';

export const CLOUD_STORAGE_ERRORS: Record<string, IErrorDefinition> = {
  FILE_REQUIRED: {
    code: 'CLOUD_STORAGE_FILE_REQUIRED',
    status: HttpStatus.BAD_REQUEST,
    message: 'A file is required',
  },
  FILE_TOO_LARGE: {
    code: 'CLOUD_STORAGE_FILE_TOO_LARGE',
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    message: 'The file is too large',
  },
  UPLOAD_FAILED: {
    code: 'CLOUD_STORAGE_UPLOAD_FAILED',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'File upload failed',
  },
};

export interface IErrorDefinition {
  code: string;
  status: HttpStatus;
  message: string;
}
