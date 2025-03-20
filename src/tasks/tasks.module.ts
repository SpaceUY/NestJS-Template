// ===== Types =====
import type { DynamicModule } from "@nestjs/common";
import type { BaseErrorHandlerService } from "./interfaces/error-handler.base.service";
import type { BaseSuccessHandlerService } from "./interfaces/success-handler.base.service";
import type { SequenceDefinition } from "./task-sequence.module";

import { TaskStatusManager } from "@/modules/core/tasks/shared/services/task.status-manager.service";
import { DynamoDBModule } from "@/modules/infrastructure/aws/dynamodb/dynamodb.module";

import { CacheModule } from "@/modules/infrastructure/cache/cache.module";
import { Global, Module } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";

// ===== Modules =====
import { BullQueuesModule } from "./adapters/bull/tasks.bull.module";

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
import { TasksRepository } from "./providers/tasks.repository";

/**
 * The TasksModule is a global module that registers all task definitions and provides a TaskRegistry and TaskExecutor.
 * It essentially acts as a single thread of execution for all registered tasks.
 */
@Global()
@Module({})
export class TasksModule {
  /**
   * Initialize the Tasks module with task sequence modules.
   * @param {DynamicModule} modules - TaskSequenceModules to be registered.
   * @returns {DynamicModule} - A dynamic module with the TasksRegistry and TaskExecutor.
   */
  static forRoot(modules: DynamicModule[]): DynamicModule {
    if (modules.length === 0) {
      throw new Error("At least one task sequence module must be provided.");
    }

    // Extract sequence names from the modules, and build the necessary injection tokens.
    const sequenceNames = modules.map(module => (module as any).sequenceName);
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
        logger: PinoLogger,
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
        PinoLogger,
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
      inject: [PinoLogger, ...sequenceDefinitionTokens],
    };

    return {
      module: TasksModule,
      imports: [DynamoDBModule, BullQueuesModule, CacheModule, ...modules],
      providers: [
        sequenceRegistryProvider,
        taskRegistryProvider,
        TasksRepository,
        TaskExecutor,
        TaskStatusManager,
      ],
      exports: [
        SequenceRegistry,
        TaskRegistry,
        TaskExecutor,
        TaskStatusManager,
      ],
    };
  }
}
