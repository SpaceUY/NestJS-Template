import { Module } from '@nestjs/common';
import { QueueConsumerModule } from '../../queues/abstract/consumer/queue-consumer.module';
import { QueueProducerService } from '../../queues/abstract/producer/queue-producer.service';
import { BullMqProducerAdapter } from '../../queues/bullmq-adapter/bullmq-producer.adapter';
import { SpaceshipNotificationProducer } from './notification.producer';
import { SpaceshipNotificationProcessor } from './notification.processor';
import { SPACESHIP_NOTIFICATION_QUEUE } from './notification.constants';
import { NotificationRecipientsAbstractModule } from './notification-recipients-abstract.module';
import { ConfigNotificationRecipientsProvider } from './config-notification-recipients.provider';
import {
  notificationRecipientsScope,
  NotificationRecipientsScopeConfig,
} from './config/notification-recipients.scope';

/**
 * Everything this domain needs in order to produce and consume its own
 * notification queue. Nothing under `src/queues/` names a class from here —
 * the binding travels the other way, which is what keeps `queues` liftable
 * (`src/queues/CLAUDE.md`, Rule 2).
 */
@Module({
  imports: [
    // `forFeature` binds the queue to the handler but does **not** provide it;
    // this module does, below. That is why `NotificationRecipientsProvider` —
    // a non-global provider the handler injects — resolves without anyone
    // copying it into the queue registration.
    QueueConsumerModule.forFeature([
      {
        queue: SPACESHIP_NOTIFICATION_QUEUE,
        handler: SpaceshipNotificationProcessor,
      },
    ]),
    NotificationRecipientsAbstractModule.forRootAsync({
      inject: [notificationRecipientsScope.KEY],
      useFactory: (config: NotificationRecipientsScopeConfig) =>
        new ConfigNotificationRecipientsProvider(config),
    }),
  ],
  providers: [
    SpaceshipNotificationProducer,
    SpaceshipNotificationProcessor,
    // Documented exception to `T1`, sanctioned by `src/queues/CLAUDE.md`
    // Rule 1: this notification needs BullMQ's `attempts`/`backoff`, which
    // live on the concrete adapter — the abstract `QueueProducerService`
    // exposes only broker-agnostic `delay`/`priority`. The alias makes the
    // concrete class injectable without a second live connection.
    //
    // The `instanceof` guard is the point. A plain `useExisting` still
    // compiles and still boots after the wired adapter is swapped for
    // RabbitMQ or SQS, and the first `addJob` then dies with "is not a
    // function" inside the request path. This turns that into a startup
    // failure instead — see src/queues/README.md, `## Registration`.
    {
      provide: BullMqProducerAdapter,
      useFactory: (producer: QueueProducerService): BullMqProducerAdapter => {
        if (!(producer instanceof BullMqProducerAdapter)) {
          throw new Error(
            `SpaceshipNotificationQueueModule: BullMqProducerAdapter was requested but the wired producer is ${producer.constructor.name}. ` +
              'A broker swap means rewriting this producer against the abstract API — see src/queues/CLAUDE.md, Rule 1.',
          );
        }
        return producer;
      },
      inject: [QueueProducerService],
    },
  ],
  exports: [SpaceshipNotificationProducer],
})
export class SpaceshipNotificationQueueModule {}
