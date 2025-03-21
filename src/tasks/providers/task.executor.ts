/* eslint-disable ts/no-explicit-any */
import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { TaskStatusManager } from './task.status-manager';
import { SequenceRegistry } from './sequence.registry';
import { TaskRegistry } from './task.registry';
import type { BaseTaskService } from '../interfaces/task.base.service';
import { ERROR_CODES } from '../constants/error-codes';
import { JOB_STATUSES } from '../constants/job-statuses';
import { EMPTY_PAYLOAD } from '../constants/payloads';
import { getStableStringFromPayload } from '../helpers/get-stable-string';
import { TaskLogger } from '../interfaces/logger.interface';
import { TASK_LOGGER } from '../constants/tokens';

/**
 * The TaskExecutor is responsible for executing tasks in a pipe-and-filter pattern.
 * It executes tasks sequentially, passing the output of one task as input to the next.
 * Tasks are idempotent, identified by a hash of their ID and input payload.
 */
@Injectable()
export class TaskExecutor {
  constructor(
    private readonly taskStatusManager: TaskStatusManager,
    private readonly sequenceRegistry: SequenceRegistry,
    private readonly taskRegistry: TaskRegistry,
    @Inject(TASK_LOGGER) private readonly logger: TaskLogger,
  ) {
    this.logger.setContext(TaskExecutor.name);
  }

  /**
   * Start a task sequence with an initial payload
   * @param {string} sequence - Name of the sequence to start.
   * @param {object} initialPayload - Initial data for the first task.
   * @returns {Promise<string>} - The ID of the onboarding process, for tracking purposes.
   * @throws {Error} - If the sequence is not found.
   */
  async startSequence(
    sequence: string,
    initialPayload: object = {},
  ): Promise<string> {
    const sequenceDefinition = this.sequenceRegistry.getSequence(sequence);
    // This is the task identifier. It's the same for all instances of this task.
    // Not to be confused with the job (sequence) ID, which is unique for each sequence execution,
    // and is used for querying.
    const { startTaskHandler, firstTaskId: taskId } = sequenceDefinition ?? {};

    // Queue task execution. Job ID is deterministic, based on sequence name and payload.
    // This enables caching startegies to work.
    const jobId = this._generateDeterministicId(sequence, initialPayload);

    if (startTaskHandler) {
      await startTaskHandler?.handleStartTask(jobId, taskId, initialPayload);
    } else {
      this.logger.info({
        message: 'No start task handler found, executing task immediately...',
        data: { jobId, taskId, payload: initialPayload },
      });

      await this.execute(jobId, taskId, initialPayload);
    }

    this.logger.debug({
      message: 'Setting job status as pending...',
      data: { jobId },
    });

    await this.taskStatusManager.setJobStatus(jobId, JOB_STATUSES.PENDING);
    await this.taskStatusManager.setJobType(jobId, sequence);

    return jobId;
  }

  /**
   * Execute a task with the given ID and payload
   * @param {string} jobId - The ID of the job being executed.
   * @param {string} taskId - The ID of the task to execute.
   * @param {object} payload - The input payload for the task.
   * @returns {Promise<void>} - The result of the task execution.
   * @throws {Error} - If the task is not found.
   */
  async execute(jobId: string, taskId: string, payload: object): Promise<void> {
    const task = this.taskRegistry.getTask(taskId);

    if (!task) {
      throw new Error(
        JSON.stringify({
          code: ERROR_CODES.TASK_NOT_FOUND,
          data: { taskId },
        }),
      );
    }

    // Check if the job has already ran, by checking for a cache hit on the result.
    const cachedResult = await this.taskStatusManager.getTaskResult(
      jobId,
      taskId,
    );

    let nextPayload: object;

    const sequenceName = this.taskRegistry.getParentSequenceId(taskId);
    const sequence = this.sequenceRegistry.getSequence(sequenceName);

    if (!cachedResult) {
      try {
        nextPayload = await this._executeTask(jobId, taskId, task, payload);
      } catch (err) {
        this.logger.error({
          message: `Task failed, setting job status to failed...`,
          data: { jobId, taskId, err },
        });

        // Handle task execution error gracefully, by setting the job status to failed,
        // and calling the corresponding error handler.
        await this.taskStatusManager.setJobStatus(jobId, JOB_STATUSES.FAILED);

        const { errorHandler } = sequence ?? {};

        await errorHandler?.handleError(jobId, err);

        return;
      }
    } else {
      this.logger.info({
        message: "Task already executed, using previous execution's result...",
        data: { jobId, taskId, cachedResult },
      });

      nextPayload = cachedResult === EMPTY_PAYLOAD ? {} : cachedResult;
    }

    // If there's a next task, execute it.
    await this._executeNextTask(jobId, taskId, sequenceName, nextPayload);
  }

  /**
   * Execute a task with the given ID and payload.
   * This is separated for clarity only, so that the main `execute` reads easier with the cache manipulation.
   * @param {string} jobId - The ID of the job being executed.
   * @param {string} taskId - The ID of the task to execute.
   * @param {BaseTaskService} task - The task to execute. Provider conforming to the `BaseTaskService` interface.
   * @param {object} payload - The input payload for the task.
   * @returns {Promise<object>} - The result of the task execution.
   */
  private async _executeTask(
    jobId: string,
    taskId: string,
    task: BaseTaskService,
    payload: object,
  ): Promise<object> {
    // Update the job status and current task in cache layer.
    await this.taskStatusManager.setJobStatus(jobId, JOB_STATUSES.RUNNING);
    await this.taskStatusManager.setCurrentTask(jobId, taskId);

    // Execute the pulled task.
    this.logger.debug({
      message: 'Executing task...',
      data: { taskId, payload },
    });

    const nextPayload = await task.execute(payload);

    this.logger.info({
      message: 'Task executed successfully',
      data: { taskId, payload },
    });

    this.logger.debug({
      message: `Caching task result...`,
      data: { taskId, payload, nextPayload },
    });

    await this.taskStatusManager.setTaskResult(jobId, taskId, nextPayload);

    return nextPayload ?? {};
  }

  /**
   * Queues next task in line for execution, if any exists.
   * @param {string} jobId - The ID of the job being executed.
   * @param {string} taskId - The ID of the task to execute.
   * @param {string} sequenceName - The name of the sequence being executed.
   * @param {object} payload - The input payload for the task.
   * @returns {Promise<void>}.
   */
  private async _executeNextTask(
    jobId: string,
    taskId: string,
    sequenceName: string,
    payload: object,
  ): Promise<void> {
    // If there's a next task, execute it.
    const nextTaskId = this.taskRegistry.getNextTaskId(taskId);

    const sequence = this.sequenceRegistry.getSequence(sequenceName);

    if (!nextTaskId) {
      this.logger.info({
        message: `Job completed`,
        data: { jobId },
      });

      const { successHandler } = sequence ?? {};
      await successHandler?.handleSuccess(jobId);

      // Mark job as finished and return
      await this.taskStatusManager.setJobStatus(jobId, JOB_STATUSES.COMPLETED);

      return;
    }

    this.logger.info({
      message: `Queueing next task...`,
      data: { taskId: nextTaskId, payload },
    });

    const { startTaskHandler } = sequence ?? {};

    if (startTaskHandler) {
      await startTaskHandler?.handleStartTask(jobId, nextTaskId, payload);
    } else {
      this.logger.info({
        message: 'No start task handler found, executing task immediately...',
        data: { jobId, taskId: nextTaskId, payload },
      });

      await this.execute(jobId, nextTaskId, payload);
    }

    this.logger.info({
      message: 'Next task handler executed successfully',
      data: { jobId, taskId: nextTaskId, payload },
    });
  }

  /**
   * Generates a deterministic ID based on sequence name and payload for a job execution.
   * @param {string} sequence - The sequence name
   * @param {object} payload - The task payload
   * @returns {string} A deterministic ID as a hex string
   */
  private _generateDeterministicId(sequence: string, payload: any): string {
    // Convert payload to a stable string representation
    // Note: JSON.stringify order is not guaranteed for objects, so we need to sort keys
    const payloadString = getStableStringFromPayload(payload);

    // Combine sequence and payload into a single string
    const inputString = `${sequence}:${payloadString}`;

    // Create a hash of the input string
    return createHash('sha256').update(inputString).digest('hex');
  }
}
