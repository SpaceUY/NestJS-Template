import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { PushNotificationDto } from './dto/push-notification.dto';

/**
 * OpenAPI metadata for the endpoint that sends a push notification to a specific device token.
 * Adds request body schema, route parameter, operation summary, and response documentation.
 * @returns {MethodDecorator} Swagger metadata decorators for the push notification handler.
 */
export function SendPushNotificationMetadata(): MethodDecorator {
  return applyDecorators(
    ApiBody({ type: PushNotificationDto }),
    ApiParam({ name: 'token' }),
    ApiOperation({ summary: 'Send notification to a specific device token' }),
    ApiResponse({ status: 200, description: 'Complete' }),
  );
}
