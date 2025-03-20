import { TaskStatusManager } from "@/modules/core/tasks/shared/services/task.status-manager.service";
import { MockCacheService } from "@/modules/infrastructure/cache/tests/mocks/cache.service.mock";
import { MockLogger } from "@/modules/infrastructure/logger/tests/mocks/logger.mock";

export class MockTaskStatusManager extends TaskStatusManager {
  constructor() {
    super(new MockLogger(), new MockCacheService());
  }

  public setJobStatus = jest.fn();
  public setJobType = jest.fn();
  public getTaskResult = jest.fn();
  public setTaskResult = jest.fn();
  public setCurrentTask = jest.fn();
}
