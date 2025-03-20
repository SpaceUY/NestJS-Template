/* eslint-disable ts/no-explicit-any */
import type { DynamicModule, Provider, Type } from "@nestjs/common";
import { Module } from "@nestjs/common";

// ===== Services & Interfaces =====
import type { BaseTaskService } from "./interfaces/task.base.service";
import { DefaultErrorHandlerService } from "./interfaces/default-error-handler.service";
import { DefaultSuccessHandlerService } from "./interfaces/default-success-handler.service";
import { BaseErrorHandlerService } from "./interfaces/error-handler.base.service";
import { BaseSuccessHandlerService } from "./interfaces/success-handler.base.service";

// ===== Helpers =====
import {
  createSequenceDefinitionToken,
  createSequenceErrorHandlerToken,
  createSequenceSuccessHandlerToken,
} from "./constants/injection-tokens";


/**
 * Interface for task registration
 */
export interface TaskRegistration {
  id: string;
  task: Type<BaseTaskService>;
}

/**
 * Interface for task definition
 */
export interface TaskDefinition {
  id: string;
  task: BaseTaskService;
  parentSequenceId: string;
  nextTaskId?: string;
}

/**
 * Interface for sequence definition
 */
export interface SequenceDefinition {
  name: string;
  firstTaskId: string;
  tasks: TaskDefinition[];
  errorHandler: BaseErrorHandlerService;
  successHandler: BaseSuccessHandlerService;
}

/**
 * The options for the TaskSequenceModule.
 * This is used to register a task sequence with its dependencies.
 * @property {string} sequenceName - The name of the task sequence.
 * @property {TaskRegistration[]} tasks - The task registrations, each with an ID and task class.
 * @property {Type<BaseErrorHandlerService>} errorHandler - A service that handles errors that occur during the task sequence.
 * @property {Type<BaseSuccessHandlerService>} successHandler - A service that handles the success of the task sequence execution.
 * @property {Type<any>[]} imports - The imports for the module.
 * @property {Provider[]} providers - The providers for the module.
 * @property {(Provider | Type<any>)[]} exports - The exports for the module.
 */
export interface TaskSequenceModuleOptions {
  sequenceName: string;
  tasks: TaskRegistration[];
  errorHandler?: Type<BaseErrorHandlerService>;
  successHandler?: Type<BaseSuccessHandlerService>;
  //
  imports?: (DynamicModule | Type<any>)[];
  providers?: Provider[];
  exports?: (Provider | Type<any>)[];
}

/**
 * The TaskSequenceModule is a module that registers a task sequence with its dependencies.
 * This is intended to be imported in the TaskModule, as it will register the task definitions specified here,
 * allowing the TaskExecutor to pick them up and process them.
 */
@Module({})
export class TaskSequenceModule {
  /**
   * Register a task sequence with its dependencies.
   * @param {TaskSequenceModuleOptions} options - Configuration options including tasks and their dependencies
   * @returns {TaskSequenceModule} - A dynamic module with task definitions and their dependencies
   */
  static register(options: TaskSequenceModuleOptions): DynamicModule {
    const { 
      sequenceName,
      tasks,
      errorHandler,
      successHandler,
      imports = [],
      providers = [],
      exports = []
    } = options;

    if (!sequenceName) {
      throw new Error("TaskSequenceModule requires a unique name");
    }

    if (!tasks || tasks.length === 0) {
      throw new Error("TaskSequenceModule requires at least one task");
    }

    // Create a unique injection tokens for this module's sequence, error handler, and success handler.
    const sequenceDefinitionToken = createSequenceDefinitionToken(sequenceName);
    const sequenceErrorHandlerToken
      = createSequenceErrorHandlerToken(sequenceName);
    const sequenceSuccessHandlerToken
      = createSequenceSuccessHandlerToken(sequenceName);

    // Grab the provider for each task. This will be used to inject the task instances.
    const taskClassProviders = tasks.map(task => task.task);

    // Create a factory that returns an array of task definitions
    const sequenceDefinitionProvider = {
      provide: sequenceDefinitionToken,
      useFactory: (
        ...taskInstances: BaseTaskService[]
      ): Omit<SequenceDefinition, "errorHandler" | "successHandler"> => {
        return {
          name: sequenceName,
          firstTaskId: tasks[0].id,
          tasks: tasks.map((task, index) => {
            // Grab the next task ID in the sequence. If it's the last task, set to undefined.
            const nextTaskId = tasks[index + 1]?.id;

            return {
              id: task.id,
              task: taskInstances[index],
              nextTaskId,
              parentSequenceId: sequenceName,
            };
          }),
        };
      },
      inject: [...taskClassProviders],
    };

    const module = {
      module: TaskSequenceModule,
      imports: [...imports],
      providers: [
        ...(providers ?? []),
        ...taskClassProviders,
        sequenceDefinitionProvider,
        {
          provide: sequenceErrorHandlerToken,
          useClass: errorHandler ?? DefaultErrorHandlerService,
        },
        {
          provide: sequenceSuccessHandlerToken,
          useClass: successHandler ?? DefaultSuccessHandlerService,
        },
      ],
      exports: [
        ...(exports ?? []),
        sequenceDefinitionToken,
        sequenceErrorHandlerToken,
        sequenceSuccessHandlerToken,
      ],
    };

    // Attach the sequence name as a custom property to the module.
    // This won't be used by NestJS but we can access it. It's a little hack to derive module-specific injection tokens.
    (module as any).sequenceName = options.sequenceName;

    return module;
  }
}
