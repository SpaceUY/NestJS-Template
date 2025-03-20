import { Injectable } from "@nestjs/common";

// ===== Types & Abstract classes =====
import type { BaseTaskService } from "../interfaces/task.base.service";
import type { TaskDefinition } from "../task-sequence.module";

// ===== Common =====
import { ERROR_CODES } from "../constants/error-codes";

@Injectable()
export class TaskRegistry {
  private readonly _tasks: Map<string, TaskDefinition> = new Map();

  // TODO: Use a different injection token.
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
   * @throws {Error} - If the task is not found.
   */
  getTask(taskId: string): BaseTaskService {
    const task = this._getTaskDefinition(taskId);
    return task.task;
  }

  /**
   * Get the parent sequence ID of a task
   * @param {string} taskId - The ID of the task to retrieve.
   * @returns {string} - The ID of the parent sequence.
   * @throws {Error} - If the task is not found.
   */
  getParentSequenceId(taskId: string): string {
    const task = this._getTaskDefinition(taskId);
    return task.parentSequenceId;
  }

  /**
   * Get the ID of the next task in the sequence
   * @param {string} taskId - The ID of the current task
   * @returns {string | undefined} - The ID of the next task, or undefined if there is no next task
   * @throws {Error} - If the task is not found.
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
   * @throws {Error} - If the task is not found.
   */
  private _getTaskDefinition(taskId: string): TaskDefinition {
    const taskDef = this._tasks.get(taskId);

    if (!taskDef) {
      throw new Error(JSON.stringify({
        code: ERROR_CODES.TASK_NOT_FOUND,
        data: { taskId },
      }));
    }

    return taskDef;
  }
}
