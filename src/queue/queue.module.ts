import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {
  redisQueueScope,
  RedisQueueScopeConfig,
} from './config/redis-queue.scope';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [redisQueueScope.KEY],
      useFactory: (redis: RedisQueueScopeConfig) => ({
        connection: {
          host: redis.host,
          port: redis.port,
          password: redis.password || undefined,
        },
      }),
    }),
  ],
})
export class QueueModule {}
