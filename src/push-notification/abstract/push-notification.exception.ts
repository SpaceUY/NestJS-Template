import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom exception for the PushNotification module.
 */
export class PushNotificationException extends HttpException {
  constructor(message: string, code: string, status: HttpStatus) {
    super({ message, code }, status);
  }
}
