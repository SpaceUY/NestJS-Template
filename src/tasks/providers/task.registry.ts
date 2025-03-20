import type { BaseTaskService } from "@/modules/core/tasks/background/interfaces/task.base.service";
// ===== Types & Abstract classes =====
import type { TaskDefinition } from "@/modules/core/tasks/background/task-sequence.module";

// ===== Common =====
import { ERROR_CODES } from "@/common/enums/error-codes.enum";
import { ApiException } from "@/common/expections/api.exception";

import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";

@Injectable()
export class TaskRegistry {
  private readonly _tasks: Map<string, TaskDefinition> = new Map();

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(TaskRegistry.name);
  }

  /**
   * Register a task definition in the registry
   * @param {TaskDefinition} taskDefinition The task definition to register
   */
  registerTask(taskDefinition: TaskDefinition): void {
    if (this._tasks.has(taskDefinition.id)) {
      throw new Error(
        `Task with ID ${taskDefinition.id} is already registered`,
      );
    }
    this._tasks.set(taskDefinition.id, taskDefinition);
    this.logger.info({
      message: "Task registered",
      data: { taskId: taskDefinition.id },
    });
  }

  /**
   * Get a task from the registry by its ID.
   * @param {string} taskId - The ID of the task to retrieve.
   * @returns {BaseTaskService} - The task implementation.
   */
  getTask(taskId: string): BaseTaskService {
    const task = this._getTaskDefinition(taskId);
    return task.task;
  }

  /**
   * Get the parent sequence ID of a task
   * @param {string} taskId - The ID of the task to retrieve.
   * @returns {string} - The ID of the parent sequence.
   */
  getParentSequenceId(taskId: string): string {
    const task = this._getTaskDefinition(taskId);
    return task.parentSequenceId;
  }

  /**
   * Get the ID of the next task in the sequence
   * @param {string} taskId - The ID of the current task
   * @returns {string | undefined} - The ID of the next task, or undefined if there is no next task
   */
  getNextTaskId(taskId: string): string | undefined {
    const task = this._getTaskDefinition(taskId);
    return task?.nextTaskId;
  }

  /**
   * Check if a task exists in the registry.
   * @param {string} taskId - The ID of the task to check.
   * @returns {boolean}
   */
  hasTask(taskId: string): boolean {
    return this._tasks.has(taskId);
  }

  /**
   * Get a task definition the registry by its ID.
   * @param {string} taskId - The ID of the task to retrieve.
   * @returns {TaskDefinition} - The task definition, including the task implementation and next task ID.
   */
  private _getTaskDefinition(taskId: string): TaskDefinition {
    const taskDef = this._tasks.get(taskId);

    if (!taskDef) {
      throw new ApiException({
        code: ERROR_CODES.TASK_NOT_FOUND,
        data: { taskId },
      });
    }

    return taskDef;
  }
}
