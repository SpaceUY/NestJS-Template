import type { FactoryProvider } from '@nestjs/common';

import { TasksModule } from '../../tasks.module';
import { TaskSequenceModule } from '../../task-sequence.module';
import { TaskExecutor } from '../../providers/task.executor';
import { TaskRegistry } from '../../providers/task.registry';
import { SequenceRegistry } from '../../providers/sequence.registry';
import { TaskStatusManager } from '../../providers/task.status-manager';
import { BaseTaskService } from '../../interfaces/task.base.service';
import { BaseErrorHandlerService } from '../../interfaces/error-handler.base.service';
import { BaseSuccessHandlerService } from '../../interfaces/success-handler.base.service';

import {
  createSequenceDefinitionToken,
  createSequenceErrorHandlerToken,
  createSequenceSuccessHandlerToken,
} from '../../constants/injection-tokens';

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

describe('tasksModule', () => {
  describe('forRoot', () => {
    it('should throw an error if no task sequence modules are provided', () => {
      expect(() => TasksModule.forRoot({ taskSequences: [] })).toThrow(
        'At least one task sequence module must be provided.',
      );
    });

    it('should create a dynamic module with the correct imports and providers', () => {
      // Create a task sequence module
      const sequenceName = 'test-sequence';
      const sequenceModule = TaskSequenceModule.register({
        sequenceName,
        tasks: [
          { id: 'task-1', task: MockTask },
          { id: 'task-2', task: MockTask },
        ],
        errorHandler: MockErrorHandler,
        successHandler: MockSuccessHandler,
      });

      // Add the sequenceName property to the module (this is done internally by TaskSequenceModule)
      (sequenceModule as any).sequenceName = sequenceName;

      // Call forRoot with our sequence module
      const tasksModule = TasksModule.forRoot({
        taskSequences: [sequenceModule],
      });

      // Check module structure
      expect(tasksModule.module).toBe(TasksModule);
      expect(tasksModule.imports).toContain(sequenceModule);

      // Check that all required providers are registered
      const providerTypes = tasksModule.providers?.map((provider) =>
        typeof provider === 'function' ? provider : provider.provide,
      );

      expect(providerTypes).toContain(SequenceRegistry);
      expect(providerTypes).toContain(TaskRegistry);
      expect(providerTypes).toContain(TaskExecutor);
      expect(providerTypes).toContain(TaskStatusManager);

      // Check exports
      expect(tasksModule.exports).toContain(SequenceRegistry);
      expect(tasksModule.exports).toContain(TaskRegistry);
      expect(tasksModule.exports).toContain(TaskExecutor);
      expect(tasksModule.exports).toContain(TaskStatusManager);
    });

    it('should set up the sequence registry provider correctly', () => {
      const sequence1Name = 'sequence-1';
      const sequence2Name = 'sequence-2';

      const sequence1 = TaskSequenceModule.register({
        sequenceName: sequence1Name,
        tasks: [{ id: 'task-1-1', task: MockTask }],
      });

      const sequence2 = TaskSequenceModule.register({
        sequenceName: sequence2Name,
        tasks: [{ id: 'task-2-1', task: MockTask }],
      });

      // Add sequence names
      (sequence1 as any).sequenceName = sequence1Name;
      (sequence2 as any).sequenceName = sequence2Name;

      const tasksModule = TasksModule.forRoot({
        taskSequences: [sequence1, sequence2],
      });

      // Find the SequenceRegistry provider
      const sequenceRegistryProvider = tasksModule.providers?.find(
        (provider) =>
          typeof provider !== 'function' &&
          provider.provide === SequenceRegistry,
      );

      // Check that it's a factory provider with the correct tokens injected
      expect(sequenceRegistryProvider).toBeDefined();
      expect(
        (sequenceRegistryProvider as FactoryProvider<any>).useFactory,
      ).toBeDefined();

      // Check that all sequence tokens are injected
      const injectedTokens = (sequenceRegistryProvider as FactoryProvider<any>)
        .inject;
      expect(injectedTokens).toContain(
        createSequenceDefinitionToken(sequence1Name),
      );
      expect(injectedTokens).toContain(
        createSequenceDefinitionToken(sequence2Name),
      );
      expect(injectedTokens).toContain(
        createSequenceErrorHandlerToken(sequence1Name),
      );
      expect(injectedTokens).toContain(
        createSequenceErrorHandlerToken(sequence2Name),
      );
      expect(injectedTokens).toContain(
        createSequenceSuccessHandlerToken(sequence1Name),
      );
      expect(injectedTokens).toContain(
        createSequenceSuccessHandlerToken(sequence2Name),
      );
    });

    it('should set up the task registry provider correctly', () => {
      const sequenceName = 'test-sequence';
      const sequenceModule = TaskSequenceModule.register({
        sequenceName,
        tasks: [{ id: 'task-1', task: MockTask }],
      });

      (sequenceModule as any).sequenceName = sequenceName;

      const tasksModule = TasksModule.forRoot({
        taskSequences: [sequenceModule],
      });

      // Find the TaskRegistry provider
      const taskRegistryProvider = tasksModule.providers?.find(
        (provider) =>
          typeof provider !== 'function' && provider.provide === TaskRegistry,
      );

      // Check that it's a factory provider with the correct tokens injected
      expect(taskRegistryProvider).toBeDefined();
      expect(
        (taskRegistryProvider as FactoryProvider<any>).useFactory,
      ).toBeDefined();

      // Check that sequence definition tokens are injected
      const injectedTokens = (taskRegistryProvider as FactoryProvider<any>)
        .inject;
      expect(injectedTokens).toContain(
        createSequenceDefinitionToken(sequenceName),
      );
    });

    it('should handle multiple sequence modules correctly', () => {
      // Create multiple sequence modules
      const sequences = ['seq-1', 'seq-2', 'seq-3'].map((name) => {
        const seq = TaskSequenceModule.register({
          sequenceName: name,
          tasks: [{ id: `${name}-task-1`, task: MockTask }],
        });
        (seq as any).sequenceName = name;
        return seq;
      });

      const tasksModule = TasksModule.forRoot({
        taskSequences: sequences,
      });

      // Check that all sequences are imported
      for (const seq of sequences) {
        expect(tasksModule.imports).toContain(seq);
      }

      // Find the SequenceRegistry provider
      const sequenceRegistryProvider = tasksModule.providers?.find(
        (provider) =>
          typeof provider !== 'function' &&
          provider.provide === SequenceRegistry,
      );

      // Check that all sequence tokens are injected
      const injectedTokens = (sequenceRegistryProvider as FactoryProvider<any>)
        .inject;
      for (const name of ['seq-1', 'seq-2', 'seq-3']) {
        expect(injectedTokens).toContain(createSequenceDefinitionToken(name));
        expect(injectedTokens).toContain(createSequenceErrorHandlerToken(name));
        expect(injectedTokens).toContain(
          createSequenceSuccessHandlerToken(name),
        );
      }
    });
  });
});
