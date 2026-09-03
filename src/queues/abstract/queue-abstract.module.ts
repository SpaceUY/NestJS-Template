import { DynamicModule, Module } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { BullmqAdapterModule } from '../bullmq-adapter/bullmq-adapter.module';
import { RabbitmqAdapterModule } from '../rabbitmq-adapter/rabbitmq-adapter.module';

dotenv.config();

export const QUEUE_ADAPTERS = {
  BULLMQ: 'BULLMQ',
  RABBITMQ: 'RABBITMQ',
} as const;

interface QueueVendorAdapterModule {
  forRoot(): DynamicModule;
  forFeature(queueName: string): DynamicModule;
}

export function getQueueAdapterName(): string {
  return (process.env.QUEUE_ADAPTER || QUEUE_ADAPTERS.BULLMQ).toUpperCase();
}

export function resolveAdapterModule(): QueueVendorAdapterModule {
  const adapter = getQueueAdapterName();

  if (adapter === QUEUE_ADAPTERS.BULLMQ) {
    return BullmqAdapterModule;
  }

  if (adapter === QUEUE_ADAPTERS.RABBITMQ) {
    return RabbitmqAdapterModule;
  }

  throw new Error(
    `Unsupported QUEUE_ADAPTER "${adapter}". Supported adapters: ${Object.values(QUEUE_ADAPTERS).join(', ')}`,
  );
}

@Module({})
export class QueueAbstractModule {
  static forRoot(): DynamicModule {
    const adapterModule = resolveAdapterModule();

    return {
      module: QueueAbstractModule,
      imports: [adapterModule.forRoot()],
    };
  }

  static forFeature(queueName: string): DynamicModule {
    const adapterModule = resolveAdapterModule();
    const inner = adapterModule.forFeature(queueName);

    return {
      module: QueueAbstractModule,
      imports: [inner],
      exports: [inner],
    };
  }
}
