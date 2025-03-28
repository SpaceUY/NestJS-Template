import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom exception for the CloudStorage module.
 */
export class CloudStorageException extends HttpException {
  constructor(message: string, code: string, status: HttpStatus) {
    super({ message, code }, status);
  }
}
