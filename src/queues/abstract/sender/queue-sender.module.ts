import { DynamicModule, Module } from '@nestjs/common';
import { QueueSenderService } from './queue-sender.service';
import {
  QueueSenderModuleAsyncOptions,
  QueueSenderModuleOptions,
} from './queue-sender.interfaces';
import { LoggerService } from '../../../common/logger/abstract/logger.service';

@Module({})
export class QueueSenderModule {
  /**
   * Configures the module with a directly-instantiated adapter (no DI for the
   * adapter itself).
   *
   * @param {QueueSenderModuleOptions} options - Adapter class and global flag.
   * @returns {DynamicModule} A dynamic module that provides and exports the sender.
   */
  static forRoot(options: QueueSenderModuleOptions): DynamicModule {
    const { adapter, isGlobal = false } = options;

    return {
      module: QueueSenderModule,
      global: isGlobal,
      providers: [
        {
          provide: QueueSenderService,
          useFactory: (logger?: LoggerService) => {
            const instance = new adapter();
            if (logger) instance.setLogger(logger);
            return instance;
          },
          inject: [{ token: LoggerService, optional: true }],
        },
      ],
      exports: [QueueSenderService],
    };
  }

  /**
   * Configures the module with an adapter built by a factory, so its
   * configuration can be resolved from DI.
   *
   * @param {QueueSenderModuleAsyncOptions} options - Factory, its injected dependencies, imports, and global flag.
   * @returns {DynamicModule} A dynamic module that provides and exports the sender.
   */
  static forRootAsync(options: QueueSenderModuleAsyncOptions): DynamicModule {
    const { isGlobal = false } = options;

    return {
      module: QueueSenderModule,
      global: isGlobal,
      imports: options.imports || [],
      providers: [
        {
          provide: QueueSenderService,
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
      ],
      exports: [QueueSenderService],
    };
  }
}
