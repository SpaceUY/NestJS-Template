import { Test, TestingModule } from '@nestjs/testing';
import { TASK_LOGGER, TASK_CACHE_HANDLER } from '../../constants/tokens';
import { TasksModule } from '../../tasks.module';
import { TaskExecutor } from '../../providers/task.executor';
import { TaskStatusManager } from '../../providers/task.status-manager';
import { DefaultTaskLogger } from '../../defaults/default.logger';
import { TaskLogger } from '../../interfaces/logger.interface';
import { BaseTaskCacheHandler } from '../../interfaces/cache-handler.base.service';
import { DefaultCacheHandlerService } from '../../defaults/default-cache-handler.service';
import { BaseTaskService } from '../../interfaces/task.base.service';
import { TaskSequenceModule } from '../../task-sequence.module';

class TestTask implements BaseTaskService {
  async execute(_: any): Promise<any> {
    return { success: true };
  }
}

describe('TasksModule Integration', () => {
  let moduleRef: TestingModule;

  // Create a mock task sequence for testing
  const TestSequenceModule = TaskSequenceModule.register({
    sequenceName: 'testSequence',
    tasks: [
      {
        id: 'testTask',
        task: TestTask,
      },
    ],
  });

  // Custom logger for testing
  class TestLogger implements TaskLogger {
    setContext(_: string): void {
      // Do nothing
    }

    info(_: any): void {
      // Do nothing
    }

    warn(_: any): void {
      // Do nothing
    }

    debug(_: any): void {
      // Do nothing
    }

    error(_: any): void {
      // Do nothing
    }
  }

  // Custom cache handler for testing
  class TestCacheHandler implements BaseTaskCacheHandler {
    private cache = new Map<string, any>();

    async set(key: string, value: string | object): Promise<void> {
      this.cache.set(key, value);
    }

    async get(key: string): Promise<string | undefined> {
      return this.cache.get(key);
    }

    async delete(key: string): Promise<void> {
      this.cache.delete(key);
    }
  }

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TasksModule.forRoot({
          taskSequences: [TestSequenceModule],
          logger: TestLogger,
          taskCacheHandler: TestCacheHandler,
        }),
      ],
    }).compile();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('should resolve the module successfully', () => {
    expect(moduleRef).toBeDefined();
  });

  it('should resolve TaskExecutor', () => {
    const taskExecutor = moduleRef.get(TaskExecutor);
    expect(taskExecutor).toBeDefined();
    expect(taskExecutor).toBeInstanceOf(TaskExecutor);
  });

  it('should resolve TaskStatusManager', () => {
    const taskStatusManager = moduleRef.get(TaskStatusManager);
    expect(taskStatusManager).toBeDefined();
    expect(taskStatusManager).toBeInstanceOf(TaskStatusManager);
  });

  it('should resolve custom TaskLogger', () => {
    const logger = moduleRef.get(TASK_LOGGER);
    expect(logger).toBeDefined();
    expect(logger).toBeInstanceOf(TestLogger);
  });

  it('should resolve custom TaskCacheHandler', () => {
    const cacheHandler = moduleRef.get(TASK_CACHE_HANDLER);
    expect(cacheHandler).toBeDefined();
    expect(cacheHandler).toBeInstanceOf(TestCacheHandler);
  });

  it('should resolve the module with default logger and cache handler', async () => {
    // Create a new module without custom logger and cache handler
    const defaultModuleRef = await Test.createTestingModule({
      imports: [
        TasksModule.forRoot({
          taskSequences: [TestSequenceModule],
        }),
      ],
    }).compile();

    const logger = defaultModuleRef.get(TASK_LOGGER);
    expect(logger).toBeDefined();
    expect(logger).toBeInstanceOf(DefaultTaskLogger);

    const cacheHandler = defaultModuleRef.get(TASK_CACHE_HANDLER);
    expect(cacheHandler).toBeDefined();
    expect(cacheHandler).toBeInstanceOf(DefaultCacheHandlerService);

    await defaultModuleRef.close();
  });

  it('should throw an error when no task sequences are provided', async () => {
    expect.assertions(2);

    try {
      await Test.createTestingModule({
        imports: [
          TasksModule.forRoot({
            taskSequences: [],
          }),
        ],
      }).compile();
    } catch (error) {
      expect(error).toBeDefined();
      expect(error?.message).toContain(
        'At least one task sequence module must be provided.',
      );
    }
  });
});
