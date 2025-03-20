import { TASKS_QUEUE_ADAPTER_TOKEN } from "@/modules/core/tasks/background/providers/task.executor";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { BullTasksQueueAdapter, TASKS_QUEUE_NAME } from "./tasks.bull.adapter";

@Module({
  imports: [
    BullModule.registerQueue({
      name: TASKS_QUEUE_NAME,
      defaultJobOptions: {
        removeOnComplete: true,
      },
    }),
  ],
  providers: [
    {
      provide: TASKS_QUEUE_ADAPTER_TOKEN,
      useClass: BullTasksQueueAdapter,
    },
    // The processor is not added here, so that we can use this module to just register the queue,
    // and use the module for writing purposes only.
  ],
  exports: [TASKS_QUEUE_ADAPTER_TOKEN],
})
export class BullQueuesModule {}
