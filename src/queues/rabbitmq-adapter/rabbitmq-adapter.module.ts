import { DynamicModule, Module } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { getQueueProducerToken } from '../abstract/queue.tokens';
import { RabbitmqProducerService } from './rabbitmq-producer.service';
import { RABBITMQ_CHANNEL, RABBITMQ_CONNECTION } from './rabbitmq.tokens';
import { rabbitmqScope, RabbitmqScopeConfig } from './config/rabbitmq.scope';
import { LoggerService } from '../../common/logger/abstract/logger.service';

@Module({})
export class RabbitmqAdapterModule {
  static forRoot(): DynamicModule {
    return {
      module: RabbitmqAdapterModule,
      global: true,
      providers: [
        {
          provide: RABBITMQ_CONNECTION,
          inject: [rabbitmqScope.KEY],
          useFactory: (config: RabbitmqScopeConfig) =>
            amqplib.connect(config.url),
        },
        {
          provide: RABBITMQ_CHANNEL,
          inject: [RABBITMQ_CONNECTION],
          useFactory: (connection: amqplib.ChannelModel) =>
            // A confirm channel, not a plain one: enqueue() waits for the
            // broker to ack the publish before resolving, so "enqueued"
            // means the broker actually has the message, not just that it
            // was written to the local socket buffer.
            connection.createConfirmChannel(),
        },
      ],
      exports: [RABBITMQ_CONNECTION, RABBITMQ_CHANNEL],
    };
  }

  static forFeature(queueName: string): DynamicModule {
    const token = getQueueProducerToken(queueName);

    return {
      module: RabbitmqAdapterModule,
      providers: [
        {
          provide: token,
          inject: [RABBITMQ_CHANNEL, LoggerService],
          useFactory: async (
            channel: amqplib.ConfirmChannel,
            logger: LoggerService,
          ) => {
            await channel.assertQueue(queueName, { durable: true });

            // This template ships no RabbitMQ consumer (README "RabbitMQ
            // adapter notes"): selecting this adapter for a queue whose only
            // processor is BullMQ-specific (e.g. `@Processor`-decorated)
            // publishes messages that nothing ever consumes.
            logger.setContext(RabbitmqAdapterModule.name);
            logger.warn({
              message:
                'RabbitMQ queue registered with no built-in consumer support',
              data: {
                queueName,
                detail:
                  'This template ships no RabbitMQ processor; verify a consumer for this queue is registered elsewhere or messages will accumulate unprocessed.',
              },
            });

            return new RabbitmqProducerService(channel, queueName);
          },
        },
      ],
      exports: [token],
    };
  }
}
