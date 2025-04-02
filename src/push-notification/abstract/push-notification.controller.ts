import {
  Body,
  Controller,
  InternalServerErrorException,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PushNotificationService } from './push-notification.service';
import { PushNotificationDto } from './dto/push-notification.dto';
import { PushNotificationException } from './push-notification.exception';

@ApiTags('Push Notification')
@Controller('push-notification')
// Use an authentication guard if the project requires it.
export class PushNotificationController {
  constructor(
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  @Post(':token/send')
  @ApiBody({ type: PushNotificationDto })
  @ApiParam({ name: 'token' })
  @ApiOperation({ summary: 'Send notification to a scpecific device token' })
  @ApiResponse({ status: 200, description: 'Complete' })
  async validatePin(
    @Param('token') token: string,
    @Body() notificationDto: PushNotificationDto,
  ): Promise<void> {
    try {
      await this.pushNotificationService.sendPushNotification(
        token,
        notificationDto,
      );
    } catch (error) {
      if (error instanceof PushNotificationException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }
}
