import { DynamicModule, Module } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { getQueueProducerToken } from '../abstract/queue.tokens';
import { RabbitmqProducerService } from './rabbitmq-producer.service';
import { RABBITMQ_CHANNEL, RABBITMQ_CONNECTION } from './rabbitmq.tokens';
import { rabbitmqScope, RabbitmqScopeConfig } from './config/rabbitmq.scope';

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
          inject: [RABBITMQ_CHANNEL],
          useFactory: async (channel: amqplib.ConfirmChannel) => {
            await channel.assertQueue(queueName, { durable: true });
            return new RabbitmqProducerService(channel, queueName);
          },
        },
      ],
      exports: [token],
    };
  }
}
