import { Module } from '@nestjs/common';
import { QueueSenderModule } from './abstract/sender/queue-sender.module';
import { QueueSenderService } from './abstract/sender/queue-sender.service';
import { QueueConsumerModule } from './abstract/consumer/queue-consumer.module';
import { BullMqSenderAdapter } from './bullmq-adapter/bullmq-sender.adapter';
import { BullMqConsumerAdapter } from './bullmq-adapter/bullmq-consumer.adapter';
import { redisScope, RedisScopeConfig } from '../redis.scope';
import { SPACESHIP_NOTIFICATION_QUEUE } from '../spaceship/notification/notification.constants';
import { SpaceshipNotificationProcessor } from '../spaceship/notification/notification.processor';
import { NotificationRecipientsAbstractModule } from '../spaceship/notification/notification-recipients-abstract.module';
import { ConfigNotificationRecipientsProvider } from '../spaceship/notification/config-notification-recipients.provider';
import {
  notificationRecipientsScope,
  NotificationRecipientsScopeConfig,
} from '../spaceship/notification/config/notification-recipients.scope';

// The concrete BullMQ adapter is named only here, per T1. `QueueConsumerModule`
// takes every queue<->handler registration in a single call, so — unlike the
// other adapter modules in this template — this one module must know about a
// domain handler class (and, transitively, its dependencies). See
// src/queues/CLAUDE.md's "Rules" for why.
@Module({
  imports: [
    QueueSenderModule.forRootAsync({
      isGlobal: true,
      inject: [redisScope.KEY],
      useFactory: (redis: RedisScopeConfig) =>
        new BullMqSenderAdapter({
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password || undefined,
          },
        }),
    }),
    QueueConsumerModule.forRootAsync({
      isGlobal: true,
      inject: [redisScope.KEY],
      useFactory: (redis: RedisScopeConfig) =>
        new BullMqConsumerAdapter({
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password || undefined,
          },
        }),
      // The handler is instantiated inside this dynamic module's own scope
      // (not the domain module's) — its non-global dependencies must be
      // imported here too.
      imports: [
        NotificationRecipientsAbstractModule.forRootAsync({
          inject: [notificationRecipientsScope.KEY],
          useFactory: (config: NotificationRecipientsScopeConfig) =>
            new ConfigNotificationRecipientsProvider(config),
        }),
      ],
      consumers: [
        {
          queue: SPACESHIP_NOTIFICATION_QUEUE,
          handler: SpaceshipNotificationProcessor,
        },
      ],
    }),
  ],
  providers: [
    // Alias so the concrete adapter's BullMQ-specific `addJob` (retry
    // attempts/backoff) is reachable — the abstract `QueueSenderService`
    // token only exposes the broker-agnostic `send`/`dispatch`.
    { provide: BullMqSenderAdapter, useExisting: QueueSenderService },
  ],
  exports: [BullMqSenderAdapter],
})
export class QueuesModule {}
