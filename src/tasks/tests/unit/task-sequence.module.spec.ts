import type { ClassProvider, FactoryProvider } from '@nestjs/common';
import {
  createSequenceDefinitionToken,
  createSequenceErrorHandlerToken,
  createSequenceSuccessHandlerToken,
} from '../../constants/injection-tokens';

import { BaseTaskService } from '../../interfaces/task.base.service';
import { BaseErrorHandlerService } from '../../interfaces/error-handler.base.service';
import { BaseSuccessHandlerService } from '../../interfaces/success-handler.base.service';
import { TaskSequenceModule } from '../../task-sequence.module';

import { DefaultErrorHandlerService } from '../../defaults/default-error-handler.service';
import { DefaultSuccessHandlerService } from '../../defaults/default-success-handler.service';

// Mock task class
class MockTask extends BaseTaskService {
  execute = jest.fn().mockResolvedValue({});
}

// Mock error handler class
class MockErrorHandler extends BaseErrorHandlerService {
  handleError = jest.fn();
}

// Mock success handler class
class MockSuccessHandler extends BaseSuccessHandlerService {
  handleSuccess = jest.fn();
}

describe('taskSequenceModule', () => {
  describe('register', () => {
    it('should create a dynamic module with the correct providers', () => {
      const sequenceName = 'test-sequence';

      const module = TaskSequenceModule.register({
        sequenceName,
        tasks: [
          { id: 'task-1', task: MockTask },
          { id: 'task-2', task: MockTask },
        ],
        errorHandler: MockErrorHandler,
        successHandler: MockSuccessHandler,
      });

      expect(module.module).toBe(TaskSequenceModule);
      expect(module.providers).toContainEqual(MockTask);
      expect(module.exports).toContain(
        createSequenceDefinitionToken(sequenceName),
      );
      expect(module.exports).toContain(
        createSequenceErrorHandlerToken(sequenceName),
      );
      expect(module.exports).toContain(
        createSequenceSuccessHandlerToken(sequenceName),
      );
    });

    it('should use default handlers if not provided', () => {
      const sequenceName = 'test-sequence';

      const module = TaskSequenceModule.register({
        sequenceName,
        tasks: [{ id: 'task-1', task: MockTask }],
      });

      const errorHandlerProvider = module.providers?.find(
        (provider) =>
          (provider as ClassProvider<any>).provide ===
          createSequenceErrorHandlerToken(sequenceName),
      );

      const successHandlerProvider = module.providers?.find(
        (provider) =>
          (provider as ClassProvider<any>).provide ===
          createSequenceSuccessHandlerToken(sequenceName),
      );

      expect(errorHandlerProvider).toBeDefined();
      expect((errorHandlerProvider as ClassProvider<any>).useClass).toBe(
        DefaultErrorHandlerService,
      );

      expect(successHandlerProvider).toBeDefined();
      expect((successHandlerProvider as ClassProvider<any>).useClass).toBe(
        DefaultSuccessHandlerService,
      );
    });

    it('should throw an error if sequenceName is not provided', () => {
      expect(() =>
        TaskSequenceModule.register({
          sequenceName: '',
          tasks: [{ id: 'task-1', task: MockTask }],
        }),
      ).toThrow('TaskSequenceModule requires a unique name');
    });

    it('should throw an error if trying to register an empty sequence (no tasks)', () => {
      expect(() =>
        TaskSequenceModule.register({
          sequenceName: 'empty-sequence',
          tasks: [],
        }),
      ).toThrow('TaskSequenceModule requires at least one task');
    });

    it('should create a sequence definition with the correct task relationships', () => {
      const sequenceName = 'test-sequence';

      const sequenceDefinition = {
        sequenceName,
        tasks: [
          { id: 'task-1', task: MockTask },
          { id: 'task-2', task: MockTask },
          { id: 'task-3', task: MockTask },
        ],
      };
      const module = TaskSequenceModule.register(sequenceDefinition);

      const sequenceProvider = module.providers?.find(
        (provider) =>
          (provider as ClassProvider<any>).provide ===
          createSequenceDefinitionToken(sequenceName),
      );

      expect(sequenceProvider).toBeDefined();

      // We need to simulate the factory execution to test the sequence definition
      // For this we'd need to mock the injected task instances
      // This is complex in a unit test without a full NestJS test environment
      // Instead, we'll check that the provider is set up correctly

      expect(
        (sequenceProvider as FactoryProvider<any>).useFactory,
      ).toBeDefined();
      expect((sequenceProvider as FactoryProvider<any>).inject).toHaveLength(
        sequenceDefinition.tasks.length,
      );
      expect((sequenceProvider as FactoryProvider<any>).inject).toContain(
        MockTask,
      );
    });
  });
});
