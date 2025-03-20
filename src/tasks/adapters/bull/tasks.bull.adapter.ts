// ===== Port =====
import type { TasksQueue } from "@/modules/infrastructure/queues/ports/tasks.queue";
import type { Queue } from "bullmq";
import type { TaskMessage } from "./processors/tasks.processor";

import { InjectQueue } from "@nestjs/bullmq";

import { Injectable } from "@nestjs/common";
// ===== Processor =====
import {
  TASK_EXECUTION_JOB,

  TASKS_QUEUE_NAME,
} from "./processors/tasks.processor";

export { TASKS_QUEUE_NAME };

/**
 * Adapter for the TasksQueue port using BullMQ.
 */
@Injectable()
export class BullTasksQueueAdapter implements TasksQueue {
  constructor(
    @InjectQueue(TASKS_QUEUE_NAME)
    private readonly tasksQueue: Queue<TaskMessage>,
  ) {}

  /**
   * Queues a task execution.
   * @param {string} taskId - The ID of the task to execute.
   * @param {object} taskPayload - The payload to execute the task with.
   * @returns {Promise<void>}
   */
  async queueTask(
    jobId: string,
    taskId: string,
    taskPayload: object,
  ): Promise<void> {
    const payload = {
      header: { jobId, taskId },
      body: taskPayload,
    };

    await this.tasksQueue.add(TASK_EXECUTION_JOB, payload);
  }
}
