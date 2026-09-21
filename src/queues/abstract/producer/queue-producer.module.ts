import { DynamicModule, Module } from '@nestjs/common';
import { QueueProducerService } from './queue-producer.service';
import {
  QueueProducerModuleAsyncOptions,
  QueueProducerModuleOptions,
} from './queue-producer.interfaces';
import { LoggerService } from '../../../common/observability/logger/abstract/logger.service';

@Module({})
export class QueueProducerModule {
  /**
   * Configures the module with a directly-instantiated adapter (no DI for the
   * adapter itself).
   *
   * @param {QueueProducerModuleOptions} options - Adapter class and global flag.
   * @returns {DynamicModule} A dynamic module that provides and exports the producer.
   */
  static forRoot(options: QueueProducerModuleOptions): DynamicModule {
    const { adapter, isGlobal = false } = options;

    return {
      module: QueueProducerModule,
      global: isGlobal,
      providers: [
        {
          provide: QueueProducerService,
          useFactory: (logger?: LoggerService) => {
            const instance = new adapter();
            if (logger) instance.setLogger(logger);
            return instance;
          },
          inject: [{ token: LoggerService, optional: true }],
        },
      ],
      exports: [QueueProducerService],
    };
  }

  /**
   * Configures the module with an adapter built by a factory, so its
   * configuration can be resolved from DI.
   *
   * @param {QueueProducerModuleAsyncOptions} options - Factory, its injected dependencies, imports, and global flag.
   * @returns {DynamicModule} A dynamic module that provides and exports the producer.
   */
  static forRootAsync<TArgs extends unknown[]>(
    options: QueueProducerModuleAsyncOptions<TArgs>,
  ): DynamicModule {
    const { isGlobal = false } = options;

    return {
      module: QueueProducerModule,
      global: isGlobal,
      imports: options.imports || [],
      providers: [
        {
          provide: QueueProducerService,
          useFactory: async (
            logger: LoggerService | undefined,
            ...args: TArgs
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
      ],
      exports: [QueueProducerService],
    };
  }
}
