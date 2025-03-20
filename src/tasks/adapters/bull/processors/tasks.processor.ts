// ===== Types =====
import type { QueuePayload } from "@/modules/infrastructure/queues/interfaces/queue-payload.interface";
import type { OnModuleInit } from "@nestjs/common";
import type { Job as Message } from "bullmq";
// ===== Providers =====
import { TaskExecutor } from "@/modules/core/tasks/background/providers/task.executor";
import { Processor, WorkerHost } from "@nestjs/bullmq";

import { ModuleRef } from "@nestjs/core";

import { PinoLogger } from "nestjs-pino";

export const TASK_EXECUTION_JOB = "EXECUTE";

// If we don't define this here and import it instead, it will be undefined.
// Why? Only God knows. Some bizarre race condition, whatever. Just leave it here.
export const TASKS_QUEUE_NAME = "tasks-queue";

export interface TaskData {
  jobId: string;
  taskId: string;
}

export type TaskMessage = Message<QueuePayload<TaskData>>;

/**
 * This processor is responsible for processing tasks.
 * Once task execution is done, this should queue the next task.
 */
@Processor(TASKS_QUEUE_NAME)
export class TasksProcessor extends WorkerHost implements OnModuleInit {
  private taskExecutor: TaskExecutor;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(TasksProcessor.name);
  }

  onModuleInit() {
    // Get the TaskExecutor instance
    this.taskExecutor = this.moduleRef.get(TaskExecutor, { strict: false });
  }

  /**
   * Process a task queue message.
   * @param message - The message to process.
   */
  async process(message: TaskMessage): Promise<void> {
    const { header, body } = message.data;
    const { jobId, taskId } = header;

    this.logger.info({
      message: "Processing queued task...",
      data: { taskId, body },
    });

    await this.taskExecutor.execute(jobId, taskId, body);
  }
}
