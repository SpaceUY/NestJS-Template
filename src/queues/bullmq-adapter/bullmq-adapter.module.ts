import { DynamicModule, Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { getQueueProducerToken } from '../abstract/queue.tokens';
import { BullmqProducerService } from './bullmq-producer.service';
import { redisScope, RedisScopeConfig } from '../../redis.scope';

@Module({})
export class BullmqAdapterModule {
  static forRoot(): DynamicModule {
    return {
      module: BullmqAdapterModule,
      imports: [
        BullModule.forRootAsync({
          inject: [redisScope.KEY],
          useFactory: (redis: RedisScopeConfig) => ({
            connection: {
              host: redis.host,
              port: redis.port,
              password: redis.password || undefined,
            },
          }),
        }),
      ],
    };
  }

  static forFeature(queueName: string): DynamicModule {
    const token = getQueueProducerToken(queueName);

    return {
      module: BullmqAdapterModule,
      imports: [BullModule.registerQueue({ name: queueName })],
      providers: [
        {
          provide: token,
          useFactory: (queue: Queue) => new BullmqProducerService(queue),
          inject: [getQueueToken(queueName)],
        },
      ],
      exports: [token],
    };
  }
}
