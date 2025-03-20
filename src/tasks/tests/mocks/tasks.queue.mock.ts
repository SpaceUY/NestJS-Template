import type { TasksQueue } from "@/modules/infrastructure/queues/ports/tasks.queue";

export class MockTasksQueue implements TasksQueue {
  public queueTask = jest.fn();
};
