import {
  DynamicModule,
  Inject,
  Module,
  OnModuleDestroy,
  OnModuleInit,
  Provider,
  Type,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { QueueConsumerAdapter } from './queue-consumer.adapter';
import { QueueConsumerHandler } from './queue-consumer.handler';
import {
  ConsumerRegistration,
  QueueConsumerModuleAsyncOptions,
  QueueConsumerModuleOptions,
} from './queue-consumer.interfaces';
import { LoggerService } from '../../../common/logger/abstract/logger.service';

const QUEUE_CONSUMERS = 'QUEUE_CONSUMERS';

@Module({})
export class QueueConsumerModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly adapter: QueueConsumerAdapter,
    @Inject(QUEUE_CONSUMERS)
    private readonly consumers: ConsumerRegistration[],
  ) {}

  static forRoot(options: QueueConsumerModuleOptions): DynamicModule {
    const { adapter, consumers, isGlobal = false } = options;

    return {
      module: QueueConsumerModule,
      global: isGlobal,
      providers: [
        {
          provide: QueueConsumerAdapter,
          useFactory: (logger?: LoggerService) => {
            const instance = new adapter();
            if (logger) instance.setLogger(logger);
            return instance;
          },
          inject: [{ token: LoggerService, optional: true }],
        },
        ...QueueConsumerModule.buildSharedProviders(consumers),
      ],
      exports: [QueueConsumerAdapter],
    };
  }

  static forRootAsync(options: QueueConsumerModuleAsyncOptions): DynamicModule {
    const { consumers, isGlobal = false } = options;

    return {
      module: QueueConsumerModule,
      global: isGlobal,
      imports: options.imports || [],
      providers: [
        {
          provide: QueueConsumerAdapter,
          useFactory: async (
            logger: LoggerService | undefined,
            ...args: unknown[]
          ) => {
            const instance = await options.useFactory(...args);
            if (logger) instance.setLogger(logger);
            return instance;
          },
          inject: [
            { token: LoggerService, optional: true },
            ...(options.inject || []),
          ],
        },
        ...QueueConsumerModule.buildSharedProviders(consumers),
      ],
      exports: [QueueConsumerAdapter],
    };
  }

  async onModuleInit(): Promise<void> {
    for (const { queue, handler } of this.consumers) {
      // `get` resolves singleton-scoped handlers only; request/transient-scoped
      // handlers are unsupported (see QueueConsumerHandler).
      const instance = this.moduleRef.get(handler);
      await this.adapter.startConsuming(queue, instance.handle.bind(instance));
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const { queue } of this.consumers) {
      await this.adapter.stopConsuming(queue);
    }
  }

  // Registers each handler class as a provider (so handlers resolve through DI
  // and can inject services) plus the registration list the lifecycle hooks
  // iterate over.
  private static buildSharedProviders(
    consumers: ConsumerRegistration[],
  ): Provider[] {
    const handlerClasses = [
      ...new Set(consumers.map((c) => c.handler)),
    ] as Type<QueueConsumerHandler>[];

    return [
      ...handlerClasses,
      { provide: QUEUE_CONSUMERS, useValue: consumers },
    ];
  }
}
