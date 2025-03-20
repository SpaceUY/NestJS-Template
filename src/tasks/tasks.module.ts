import type { DynamicModule } from "@nestjs/common";
import type { BaseErrorHandlerService } from "./interfaces/error-handler.base.service";
import type { BaseSuccessHandlerService } from "./interfaces/success-handler.base.service";
import type { SequenceDefinition } from "./task-sequence.module";
import { Module } from "@nestjs/common";

// ===== Constants =====
import {
  createSequenceDefinitionToken,
  createSequenceErrorHandlerToken,
  createSequenceSuccessHandlerToken,
} from "./constants/injection-tokens";

// ===== Providers =====
import { SequenceRegistry } from "./providers/sequence.registry";
import { TaskExecutor } from "./providers/task.executor";
import { TaskRegistry } from "./providers/task.registry";
import { TaskStatusManager } from "./providers/task.status-manager";
// import { TasksRepository } from "./providers/tasks.repository";

/**
 * Options for the TasksModule.
 * @property {DynamicModule[]} taskSequences - The TaskSequenceModules to be regist
 */
interface TasksModuleOptions {
  taskSequences: DynamicModule[];
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
    const { taskSequences } = options;

    if (taskSequences.length === 0) {
      throw new Error("At least one task sequence module must be provided.");
    }

    // Extract sequence names from the modules, and build the necessary injection tokens.
    const sequenceNames = taskSequences.map(module => (module as any).sequenceName);
    const totalSequences = sequenceNames.length;

    const sequenceDefinitionTokens = sequenceNames.map(name =>
      createSequenceDefinitionToken(name),
    );
    const sequenceErrorHandlerTokens = sequenceNames.map(name =>
      createSequenceErrorHandlerToken(name),
    );
    const sequenceSuccessHandlerTokens = sequenceNames.map(name =>
      createSequenceSuccessHandlerToken(name),
    );

    // Provider definitions
    const sequenceRegistryProvider = {
      provide: SequenceRegistry,
      useFactory: (
        logger: PinoLogger, // TODO: Replace by custom logger
        ...seqDefinitionsAndHandlers: (
          | SequenceDefinition
          | BaseErrorHandlerService
          | BaseSuccessHandlerService
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

        const registry = new SequenceRegistry(logger);

        // Register all injected sequence definitions
        seqDefinitions.forEach((definition, index) => {
          const errorHandler = seqErrorHandlers[index];
          const successHandler = seqSuccessHandlers[index];

          definition.errorHandler = errorHandler;
          definition.successHandler = successHandler;

          registry.registerSequence(definition);
        });

        return registry;
      },
      inject: [
        PinoLogger, // TODO: Replace by custom logger
        ...sequenceDefinitionTokens,
        ...sequenceErrorHandlerTokens,
        ...sequenceSuccessHandlerTokens,
      ],
    };

    const taskRegistryProvider = {
      provide: TaskRegistry,
      useFactory: (
        logger: PinoLogger,
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
      inject: [
        PinoLogger, // TODO: Replace by custom logger
        ...sequenceDefinitionTokens,
      ],
    };

    return {
      module: TasksModule,
      imports: [...taskSequences],
      providers: [
        sequenceRegistryProvider,
        taskRegistryProvider,
        TaskExecutor,
        TaskStatusManager,
      ],
      exports: [
        TaskExecutor,
        TaskStatusManager,
      ],
    };
  }
}
