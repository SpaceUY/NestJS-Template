import { Module } from '@nestjs/common';
import { SPACESHIP_NOTIFICATION_QUEUE } from './notification.constants';
import { SpaceshipNotificationProducer } from './notification.producer';
import { SpaceshipNotificationProcessor } from './notification.processor';
import { ConfigNotificationRecipientsProvider } from './config-notification-recipients.provider';
import { NotificationRecipientsAbstractModule } from './notification-recipients-abstract.module';
import {
  notificationRecipientsScope,
  NotificationRecipientsScopeConfig,
} from './config/notification-recipients.scope';
import { QueueAbstractModule } from '../abstract/queue-abstract.module';

@Module({
  imports: [
    QueueAbstractModule.forFeature(SPACESHIP_NOTIFICATION_QUEUE),
    NotificationRecipientsAbstractModule.forRootAsync({
      inject: [notificationRecipientsScope.KEY],
      useFactory: (config: NotificationRecipientsScopeConfig) =>
        new ConfigNotificationRecipientsProvider(config),
    }),
  ],
  providers: [SpaceshipNotificationProducer, SpaceshipNotificationProcessor],
  exports: [SpaceshipNotificationProducer],
})
export class SpaceshipNotificationQueueModule {}
