import type { DynamicModule, Type } from '@nestjs/common';
import type { BaseErrorHandlerService } from './interfaces/error-handler.base.service';
import type { BaseSuccessHandlerService } from './interfaces/success-handler.base.service';
import type { BaseStartTaskHandlerService } from './interfaces/start-task-handler.base.service';
import type { BaseTaskCacheHandler } from './interfaces/cache-handler.base.service';
import type { SequenceDefinition } from './task-sequence.module';
import { Module, Provider } from '@nestjs/common';

// ===== Constants =====
import {
  createSequenceDefinitionToken,
  createSequenceErrorHandlerToken,
  createSequenceStartTaskHandlerToken,
  createSequenceSuccessHandlerToken,
} from './constants/injection-tokens';
import { TASK_LOGGER, TASK_CACHE_HANDLER } from './constants/tokens';

// ===== Providers =====
import { SequenceRegistry } from './providers/sequence.registry';
import { TaskExecutor } from './providers/task.executor';
import { TaskRegistry } from './providers/task.registry';
import { TaskStatusManager } from './providers/task.status-manager';
import { DefaultTaskLogger } from './providers/default.logger';
import { TaskLogger } from './interfaces/logger.interface';
import { DefaultCacheHandlerService } from './interfaces/default-cache-handler.service';

/**
 * Options for the TasksModule.
 * @property {DynamicModule[]} taskSequences - The TaskSequenceModules to be regist
 * @property {Provider<TaskLogger>} logger ? - The logger to be used for the tasks.
 */
interface TasksModuleOptions {
  taskSequences: DynamicModule[];
  taskCacheHandler?: Type<BaseTaskCacheHandler>;
  logger?: Provider<TaskLogger>;
}

/**
 * The TasksModule is a module that registers all task definitions and provides a `TaskExecutor` export
 * that allows consumers to execute tasks sequences, which are called "jobs" once instantiated..
 * It essentially acts as a single thread of execution for all registered tasks.
 */
@Module({})
export class TasksModule {
  /**
   * Initialize the Tasks module with task sequence modules.
   * @param {TasksModuleOptions} modules -
   * @returns {DynamicModule} - A dynamic module with the TasksRegistry and TaskExecutor.
   */
  static forRoot(options: TasksModuleOptions): DynamicModule {
    const { taskSequences, taskCacheHandler, logger } = options;

    if (taskSequences.length === 0) {
      throw new Error('At least one task sequence module must be provided.');
    }

    const loggerProvider: Provider<TaskLogger> = logger
      ? logger
      : {
          provide: TASK_LOGGER,
          useClass: DefaultTaskLogger,
        };

    const cacheHandlerProvider: Provider<BaseTaskCacheHandler> = {
      provide: TASK_CACHE_HANDLER,
      useClass: taskCacheHandler ?? DefaultCacheHandlerService,
    };

    // Extract sequence names from the modules, and build the necessary injection tokens.
    const sequenceNames = taskSequences.map(
      (module) => (module as any).sequenceName,
    );
    const totalSequences = sequenceNames.length;

    const sequenceDefinitionTokens = sequenceNames.map((name) =>
      createSequenceDefinitionToken(name),
    );
    const sequenceErrorHandlerTokens = sequenceNames.map((name) =>
      createSequenceErrorHandlerToken(name),
    );
    const sequenceSuccessHandlerTokens = sequenceNames.map((name) =>
      createSequenceSuccessHandlerToken(name),
    );
    const sequenceStartTaskHandlerTokens = sequenceNames.map((name) =>
      createSequenceStartTaskHandlerToken(name),
    );

    // Provider definitions
    const sequenceRegistryProvider = {
      provide: SequenceRegistry,
      useFactory: (
        taskLogger: TaskLogger,
        ...seqDefinitionsAndHandlers: (
          | SequenceDefinition
          | BaseErrorHandlerService
          | BaseSuccessHandlerService
          | BaseStartTaskHandlerService
        )[]
      ) => {
        // Separate the sequence definitions and handlers (success and error).
        const seqDefinitions = seqDefinitionsAndHandlers.slice(
          0,
          totalSequences,
        ) as SequenceDefinition[];

        const seqErrorHandlers = seqDefinitionsAndHandlers.slice(
          totalSequences,
          totalSequences * 2,
        ) as BaseErrorHandlerService[];

        const seqSuccessHandlers = seqDefinitionsAndHandlers.slice(
          totalSequences * 2,
          totalSequences * 3,
        ) as BaseSuccessHandlerService[];

        const seqStartTaskHandlers = seqDefinitionsAndHandlers.slice(
          totalSequences * 3,
          totalSequences * 4,
        ) as BaseStartTaskHandlerService[];

        const registry = new SequenceRegistry(taskLogger);

        // Register all injected sequence definitions
        seqDefinitions.forEach((definition, index) => {
          definition.errorHandler = seqErrorHandlers[index];
          definition.successHandler = seqSuccessHandlers[index];
          definition.startTaskHandler = seqStartTaskHandlers[index];

          registry.registerSequence(definition);
        });

        return registry;
      },
      inject: [
        TASK_LOGGER,
        ...sequenceDefinitionTokens,
        ...sequenceErrorHandlerTokens,
        ...sequenceSuccessHandlerTokens,
        ...sequenceStartTaskHandlerTokens,
      ],
    };

    const taskRegistryProvider = {
      provide: TaskRegistry,
      useFactory: (
        logger: TaskLogger,
        ...seqDefinitions: SequenceDefinition[]
      ) => {
        const registry = new TaskRegistry(logger);

        // Register all injected sequence definitions
        for (const definition of seqDefinitions) {
          for (const task of definition.tasks) {
            registry.registerTask(task);
          }
        }

        return registry;
      },
      inject: [TASK_LOGGER, ...sequenceDefinitionTokens],
    };

    return {
      module: TasksModule,
      imports: [...taskSequences],
      providers: [
        loggerProvider,
        cacheHandlerProvider,
        sequenceRegistryProvider,
        taskRegistryProvider,
        TaskExecutor,
        TaskStatusManager,
      ],
      exports: [TASK_LOGGER, TaskExecutor, TaskStatusManager],
    };
  }
}
