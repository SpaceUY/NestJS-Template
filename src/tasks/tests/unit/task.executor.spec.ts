import { JOB_STATUSES } from '../../constants/job-statuses';
import { ERROR_CODES } from '../../constants/error-codes';
import { BaseTaskService } from '../../interfaces/task.base.service';
import { TaskLogger } from '../../interfaces/logger.interface';
import { TaskExecutor } from '../../providers/task.executor';

// ===== Mocks =====
import { MockTaskStatusManager } from '../mocks/task.status-manager.service.mock';
import { MockSequenceRegistry } from '../mocks/sequence.registry.mock';
import { MockTaskRegistry } from '../mocks/task.registry.mock';
import { MockLogger } from '../mocks/logger.mock';

describe('taskExecutor', () => {
  let taskExecutor: TaskExecutor;
  let taskStatusManager: MockTaskStatusManager;
  let sequenceRegistry: MockSequenceRegistry;
  let taskRegistry: MockTaskRegistry;
  let logger: TaskLogger;

  beforeEach(() => {
    // Create mock implementations of dependencies
    logger = new MockLogger();
    taskStatusManager = new MockTaskStatusManager();
    sequenceRegistry = new MockSequenceRegistry();
    taskRegistry = new MockTaskRegistry();

    // Instantiate TaskExecutor with mocked dependencies
    taskExecutor = new TaskExecutor(
      taskStatusManager,
      sequenceRegistry,
      taskRegistry,
      logger,
    );
  });

  describe('startSequence', () => {
    it('should start a sequence and set job status to pending', async () => {
      const sequenceName = 'test-sequence';
      const firstTaskId = 'task-1';
      const initialPayload = { key: 'value' };
      const sequenceDefinition = {
        name: sequenceName,
        errorHandler: { handleError: jest.fn() },
        firstTaskId,
      };

      sequenceRegistry.getSequence.mockReturnValue(sequenceDefinition);
      taskRegistry.getTask.mockReturnValue(firstTaskId);

      const jobId = await taskExecutor.startSequence(
        sequenceName,
        initialPayload,
      );

      expect(sequenceRegistry.getSequence).toHaveBeenCalledWith(sequenceName);
      expect(taskStatusManager.setJobStatus).toHaveBeenCalledWith(
        jobId,
        JOB_STATUSES.PENDING,
      );
      expect(taskStatusManager.setJobType).toHaveBeenCalledWith(
        jobId,
        sequenceName,
      );
    });

    it('should handle errors when starting a sequence', async () => {
      const sequenceName = 'test-sequence';
      const initialPayload = { key: 'value' };
      const firstTaskId = 'task-1';
      const sequenceDefinition = {
        name: sequenceName,
        errorHandler: { handleError: jest.fn() },
        firstTaskId,
      };

      sequenceRegistry.getSequence.mockReturnValue(sequenceDefinition);

      await expect(
        taskExecutor.startSequence(sequenceName, initialPayload),
      ).rejects.toThrow(
        JSON.stringify({
          code: ERROR_CODES.TASK_NOT_FOUND,
          data: { taskId: firstTaskId },
        }),
      );

      expect(sequenceRegistry.getSequence).toHaveBeenCalledWith(sequenceName);
    });
  });

  describe('execute', () => {
    it('should execute a task and start the next task', async () => {
      const jobId = 'job-1';
      const taskId = 'task-1';
      const nextTaskId = 'task-2';
      const payload = { key: 'value' };
      const nextPayload = { nextKey: 'nextValue' };

      const task: BaseTaskService = {
        execute: jest.fn().mockResolvedValue(nextPayload),
      };

      taskRegistry.getTask.mockReturnValue(task);
      taskStatusManager.getTaskResult.mockResolvedValue(null);
      taskRegistry.getNextTaskId.mockReturnValueOnce(nextTaskId);

      await taskExecutor.execute(jobId, taskId, payload);

      expect(taskRegistry.getTask).toHaveBeenCalledWith(taskId);
      expect(taskStatusManager.getTaskResult).toHaveBeenCalledWith(
        jobId,
        taskId,
      );
      expect(task.execute).toHaveBeenCalledWith(payload);
      expect(taskStatusManager.setTaskResult).toHaveBeenCalledWith(
        jobId,
        taskId,
        nextPayload,
      );
    });

    it('should not start another task if there is no next task', async () => {
      const jobId = 'job-1';
      const taskId = 'task-1';
      const payload = { key: 'value' };
      const nextPayload = { nextKey: 'nextValue' };

      const task: BaseTaskService = {
        execute: jest.fn().mockResolvedValue(nextPayload),
      };

      taskRegistry.getTask.mockReturnValue(task);
      taskStatusManager.getTaskResult.mockResolvedValue(null);

      await taskExecutor.execute(jobId, taskId, payload);

      expect(taskRegistry.getTask).toHaveBeenCalledWith(taskId);
      expect(taskStatusManager.getTaskResult).toHaveBeenCalledWith(
        jobId,
        taskId,
      );
      expect(task.execute).toHaveBeenCalledWith(payload);
      expect(taskStatusManager.setTaskResult).toHaveBeenCalledWith(
        jobId,
        taskId,
        nextPayload,
      );
    });

    it('should handle task execution errors and set job status to failed', async () => {
      const jobId = 'job-1';
      const taskId = 'task-1';
      const payload = { key: 'value' };

      const task: BaseTaskService = {
        execute: jest.fn().mockRejectedValue(new Error('Task failed')),
      };

      const sequenceName = 'test-sequence';
      const sequence = {
        name: sequenceName,
        errorHandler: { handleError: jest.fn() },
        firstTaskId: taskId,
      };

      taskRegistry.getTask.mockReturnValue(task);
      taskStatusManager.getTaskResult.mockResolvedValue(null);
      taskRegistry.getParentSequenceId.mockReturnValue(sequenceName);
      sequenceRegistry.getSequence.mockReturnValue(sequence);

      await taskExecutor.execute(jobId, taskId, payload);

      expect(taskStatusManager.setJobStatus).toHaveBeenCalledWith(
        jobId,
        JOB_STATUSES.FAILED,
      );
      expect(sequence.errorHandler.handleError).toHaveBeenCalledWith(
        jobId,
        expect.any(Error),
      );
    });

    it('should throw an Error if the task is not found', async () => {
      const jobId = 'job-1';
      const taskId = 'task-1';
      const payload = { key: 'value' };

      taskRegistry.getTask.mockReturnValue(null);

      await expect(
        taskExecutor.execute(jobId, taskId, payload),
      ).rejects.toThrow(Error);
    });

    it('should complete the job if there is no next task', async () => {
      const jobId = 'job-1';
      const taskId = 'task-1';
      const payload = { key: 'value' };
      const nextPayload = { nextKey: 'nextValue' };

      const task: BaseTaskService = {
        execute: jest.fn().mockResolvedValue(nextPayload),
      };

      taskRegistry.getTask.mockReturnValue(task);
      taskStatusManager.getTaskResult.mockResolvedValue(null);
      taskRegistry.getNextTaskId.mockReturnValue(undefined);

      await taskExecutor.execute(jobId, taskId, payload);

      expect(taskRegistry.getTask).toHaveBeenCalledWith(taskId);
      expect(taskStatusManager.getTaskResult).toHaveBeenCalledWith(
        jobId,
        taskId,
      );
      expect(task.execute).toHaveBeenCalledWith(payload);
      expect(taskStatusManager.setTaskResult).toHaveBeenCalledWith(
        jobId,
        taskId,
        nextPayload,
      );
      expect(taskStatusManager.setJobStatus).toHaveBeenCalledWith(
        jobId,
        JOB_STATUSES.COMPLETED,
      );
    });

    it('should use cached task result if available', async () => {
      const jobId = 'job-1';
      const taskId = 'task-1';
      const nextTaskId = 'task-2';
      const payload = { key: 'value' };
      const cachedResult = { cachedKey: 'cachedValue' };

      taskRegistry.getTask.mockReturnValue({ execute: jest.fn() });
      taskStatusManager.getTaskResult.mockResolvedValue(cachedResult);
      taskRegistry.getNextTaskId.mockReturnValueOnce(nextTaskId);

      await taskExecutor.execute(jobId, taskId, payload);

      expect(taskRegistry.getTask).toHaveBeenCalledWith(taskId);
      expect(taskStatusManager.getTaskResult).toHaveBeenCalledWith(
        jobId,
        taskId,
      );
      expect(taskStatusManager.setTaskResult).not.toHaveBeenCalled();
    });

    it('should call the successHandler when the job completes successfully', async () => {
      const jobId = 'job-1';
      const taskId = 'task-1';
      const payload = { key: 'value' };
      const nextPayload = { nextKey: 'nextValue' };

      const task: BaseTaskService = {
        execute: jest.fn().mockResolvedValue(nextPayload),
      };

      const successHandler = { handleSuccess: jest.fn() };
      const sequenceName = 'test-sequence';
      const sequence = {
        name: sequenceName,
        successHandler,
        firstTaskId: taskId,
      };

      taskRegistry.getTask.mockReturnValue(task);
      taskStatusManager.getTaskResult.mockResolvedValue(null);
      taskRegistry.getNextTaskId.mockReturnValue(undefined);
      taskRegistry.getParentSequenceId.mockReturnValue(sequenceName);
      sequenceRegistry.getSequence.mockReturnValue(sequence);

      await taskExecutor.execute(jobId, taskId, payload);

      expect(taskRegistry.getTask).toHaveBeenCalledWith(taskId);
      expect(taskStatusManager.getTaskResult).toHaveBeenCalledWith(
        jobId,
        taskId,
      );
      expect(task.execute).toHaveBeenCalledWith(payload);
      expect(taskStatusManager.setTaskResult).toHaveBeenCalledWith(
        jobId,
        taskId,
        nextPayload,
      );
      expect(taskStatusManager.setJobStatus).toHaveBeenCalledWith(
        jobId,
        JOB_STATUSES.COMPLETED,
      );
      expect(successHandler.handleSuccess).toHaveBeenCalledWith(jobId);
    });
  });

  describe('_generateDeterministicId', () => {
    it('should generate a consistent deterministic ID for the same input', () => {
      const sequence = 'test-sequence';
      const payload = { key: 'value' };

      const id1 = (taskExecutor as any)._generateDeterministicId(
        sequence,
        payload,
      );
      const id2 = (taskExecutor as any)._generateDeterministicId(
        sequence,
        payload,
      );

      expect(id1).toBe(id2);
    });
  });
});
