import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PushNotificationService } from './push-notification.service';
import { PushNotificationDto } from './dto/push-notification.dto';
import {
  PUSH_NOTIFICATION_ERRORS,
  PushNotificationError,
} from './push-notification.error';
import { SendPushNotificationMetadata } from './push-notification.metadata';

@ApiTags('Push Notification')
@Controller('push-notification')
// Use an authentication guard if the project requires it.
export class PushNotificationController {
  constructor(
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  @Post(':token/send')
  @SendPushNotificationMetadata()
  async sendPushNotification(
    @Param('token') token: string,
    @Body() notificationDto: PushNotificationDto,
  ): Promise<void> {
    try {
      await this.pushNotificationService.sendPushNotification(
        token,
        notificationDto,
      );
    } catch (error) {
      throw this._asHttpException(error);
    }
  }

  /**
   * The module error carries a code, not a status: mapping one to the other is
   * the controller's job, and the message it answers with is written here
   * rather than taken from the provider.
   */
  private _asHttpException(error: unknown): Error {
    if (
      error instanceof PushNotificationError &&
      error.code === PUSH_NOTIFICATION_ERRORS.INVALID_TOKEN
    ) {
      return new BadRequestException('The push token is not valid');
    }

    return new InternalServerErrorException(
      'The push notification could not be sent',
    );
  }
}
