import { TaskRegistry } from "@/modules/core/tasks/background/providers/task.registry";
import { MockLogger } from "@/modules/infrastructure/logger/tests/mocks/logger.mock";

export class MockTaskRegistry extends TaskRegistry {
  constructor() {
    super(new MockLogger());
  }

  public registerTask = jest.fn();
  public getTask = jest.fn();
  public getParentSequenceId = jest.fn();
  public getNextTaskId = jest.fn();
  public hasTask = jest.fn();
}
