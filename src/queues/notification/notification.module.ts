import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SPACESHIP_NOTIFICATION_QUEUE } from './notification.constants';
import { SpaceshipNotificationProducer } from './notification.producer';
import { SpaceshipNotificationProcessor } from './notification.processor';
import { NotificationRecipientsProvider } from './notification-recipients.provider';
import { ConfigNotificationRecipientsProvider } from './config-notification-recipients.provider';

@Module({
  imports: [BullModule.registerQueue({ name: SPACESHIP_NOTIFICATION_QUEUE })],
  providers: [
    SpaceshipNotificationProducer,
    SpaceshipNotificationProcessor,
    {
      provide: NotificationRecipientsProvider,
      useClass: ConfigNotificationRecipientsProvider,
    },
  ],
  exports: [SpaceshipNotificationProducer],
})
export class SpaceshipNotificationQueueModule {}
