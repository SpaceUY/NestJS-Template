import { TaskStatusManager } from '../../providers/task.status-manager';
import { MockLogger } from './logger.mock';
import { MockTaskCacheHandler } from './task-cache.mock';

export class MockTaskStatusManager extends TaskStatusManager {
  constructor() {
    super(new MockLogger(), new MockTaskCacheHandler());
  }

  public setJobStatus = jest.fn();
  public setJobType = jest.fn();
  public getTaskResult = jest.fn();
  public setTaskResult = jest.fn();
  public setCurrentTask = jest.fn();
}
