import { TaskRegistry } from '../../providers/task.registry';
import { MockLogger } from './logger.mock';

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
