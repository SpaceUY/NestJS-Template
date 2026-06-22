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

  /**
   * Configures the module with a directly-instantiated adapter (no DI for the
   * adapter itself).
   *
   * @param {QueueConsumerModuleOptions} options - Adapter class, consumer registrations, and global flag.
   * @returns {DynamicModule} A dynamic module wiring the adapter, consumers, and handlers.
   */
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

  /**
   * Configures the module with an adapter built by a factory, so its
   * configuration can be resolved from DI.
   *
   * @param {QueueConsumerModuleAsyncOptions} options - Factory, its injected
   *   dependencies, consumer registrations, imports, and global flag.
   * @returns {DynamicModule} A dynamic module wiring the adapter, consumers, and handlers.
   */
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

  /**
   * Resolves each registered handler from the container and starts consuming its
   * queue. Runs once on application bootstrap.
   *
   * @returns {Promise<void>} Resolves once every registered consumer has started.
   */
  async onModuleInit(): Promise<void> {
    for (const { queue, handler } of this.consumers) {
      // `get` resolves singleton-scoped handlers only; request/transient-scoped
      // handlers are unsupported (see QueueConsumerHandler).
      const instance = this.moduleRef.get(handler);
      await this.adapter.startConsuming(queue, instance.handle.bind(instance));
    }
  }

  /**
   * Stops every registered consumer on application shutdown.
   *
   * @returns {Promise<void>} Resolves once every registered consumer has stopped.
   */
  async onModuleDestroy(): Promise<void> {
    for (const { queue } of this.consumers) {
      await this.adapter.stopConsuming(queue);
    }
  }

  /**
   * Builds the providers shared by both registration paths: each handler class
   * (so handlers resolve through DI and can inject services) plus the
   * registration list the lifecycle hooks iterate over.
   *
   * @param {ConsumerRegistration[]} consumers - The queue↔handler registrations.
   * @returns {Provider[]} The provider list to merge into the dynamic module.
   */
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
