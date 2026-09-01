import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SPACESHIP_NOTIFICATION_QUEUE } from './spaceship-notification.constants';
import { SpaceshipNotificationProducer } from './spaceship-notification.producer';
import { SpaceshipNotificationProcessor } from './spaceship-notification.processor';

@Module({
  imports: [BullModule.registerQueue({ name: SPACESHIP_NOTIFICATION_QUEUE })],
  providers: [SpaceshipNotificationProducer, SpaceshipNotificationProcessor],
  exports: [SpaceshipNotificationProducer],
})
export class SpaceshipNotificationQueueModule {}
