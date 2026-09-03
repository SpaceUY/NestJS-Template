import { DynamicModule, Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { getQueueProducerToken } from '../abstract/queue.tokens';
import { BullmqProducerService } from './bullmq-producer.service';
import {
  bullmqRedisScope,
  BullmqRedisScopeConfig,
} from './config/bullmq-redis.scope';

@Module({})
export class BullmqAdapterModule {
  static forRoot(): DynamicModule {
    return {
      module: BullmqAdapterModule,
      imports: [
        BullModule.forRootAsync({
          inject: [bullmqRedisScope.KEY],
          useFactory: (redis: BullmqRedisScopeConfig) => ({
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
