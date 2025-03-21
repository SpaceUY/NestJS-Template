import { TaskRegistry } from '../../providers/task.registry';
import { MockLogger } from '../mocks/logger.mock';

describe('taskRegistry', () => {
  let taskRegistry: TaskRegistry;
  let logger: MockLogger;

  beforeEach(() => {
    logger = new MockLogger();
    taskRegistry = new TaskRegistry(logger);
  });

  describe('registerTask', () => {
    it('should register a task successfully', () => {
      const taskDefinition = {
        id: 'task-1',
        task: {} as any,
        parentSequenceId: 'sequence-1',
      };

      taskRegistry.registerTask(taskDefinition);

      expect(logger.info).toHaveBeenCalledWith({
        message: 'Task registered',
        data: { taskId: taskDefinition.id },
      });
    });

    it('should throw an error if a task with the same ID is already registered', () => {
      const taskDefinition = {
        id: 'task-1',
        task: {} as any,
        parentSequenceId: 'sequence-1',
      };

      taskRegistry.registerTask(taskDefinition);

      expect(() => taskRegistry.registerTask(taskDefinition)).toThrow();
    });
  });

  describe('getTask', () => {
    it('should retrieve a registered task', () => {
      const taskDefinition = {
        id: 'task-1',
        task: {} as any,
        parentSequenceId: 'sequence-1',
      };

      taskRegistry.registerTask(taskDefinition);

      const task = taskRegistry.getTask(taskDefinition.id);

      expect(task).toBe(taskDefinition.task);
    });

    it('should throw an Error if the task is not found', () => {
      expect(() => taskRegistry.getTask('non-existent-task')).toThrow(Error);
    });
  });

  describe('getParentSequenceId', () => {
    it('should retrieve the parent sequence ID of a registered task', () => {
      const taskDefinition = {
        id: 'task-1',
        task: {} as any,
        parentSequenceId: 'sequence-1',
      };

      taskRegistry.registerTask(taskDefinition);

      const parentSequenceId = taskRegistry.getParentSequenceId(
        taskDefinition.id,
      );

      expect(parentSequenceId).toBe(taskDefinition.parentSequenceId);
    });
  });

  describe('getNextTaskId', () => {
    it('should retrieve the next task ID of a registered task', () => {
      const taskDefinition = {
        id: 'task-1',
        task: {} as any,
        parentSequenceId: 'sequence-1',
        nextTaskId: 'task-2',
      };

      taskRegistry.registerTask(taskDefinition);

      const nextTaskId = taskRegistry.getNextTaskId(taskDefinition.id);

      expect(nextTaskId).toBe(taskDefinition.nextTaskId);
    });

    it('should return undefined if there is no next task', () => {
      const taskDefinition = {
        id: 'task-1',
        task: {} as any,
        parentSequenceId: 'sequence-1',
      };

      taskRegistry.registerTask(taskDefinition);

      const nextTaskId = taskRegistry.getNextTaskId(taskDefinition.id);

      expect(nextTaskId).toBeUndefined();
    });
  });

  describe('hasTask', () => {
    it('should return true if a task is registered', () => {
      const taskDefinition = {
        id: 'task-1',
        task: {} as any,
        parentSequenceId: 'sequence-1',
      };

      taskRegistry.registerTask(taskDefinition);

      expect(taskRegistry.hasTask(taskDefinition.id)).toBe(true);
    });

    it('should return false if a task is not registered', () => {
      expect(taskRegistry.hasTask('non-existent-task')).toBe(false);
    });
  });
});
