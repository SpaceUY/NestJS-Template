import { ERROR_CODES } from '../../constants/error-codes';
import { SequenceRegistry } from '../../providers/sequence.registry';
import { MockLogger } from '../mocks/logger.mock';

describe('sequenceRegistry', () => {
  let sequenceRegistry: SequenceRegistry;
  let logger: MockLogger;

  beforeEach(() => {
    logger = new MockLogger();
    sequenceRegistry = new SequenceRegistry(logger);
  });

  describe('registerSequence', () => {
    it('should register a sequence successfully', () => {
      const sequenceDefinition = {
        name: 'sequence-1',
        firstTaskId: 'task-1',
        tasks: [],
        errorHandler: {} as any,
        successHandler: {} as any,
      };

      sequenceRegistry.registerSequence(sequenceDefinition);

      expect(logger.info).toHaveBeenCalledWith({
        message: 'Task sequence registered',
        data: {
          sequenceName: sequenceDefinition.name,
          tasks: [],
        },
      });
    });

    it('should throw an error if a sequence with the same name is already registered', () => {
      const sequenceDefinition = {
        name: 'sequence-1',
        firstTaskId: 'task-1',
        tasks: [],
        errorHandler: {} as any,
        successHandler: {} as any,
      };

      sequenceRegistry.registerSequence(sequenceDefinition);

      expect(() =>
        sequenceRegistry.registerSequence(sequenceDefinition),
      ).toThrow(
        JSON.stringify({
          code: ERROR_CODES.TASK_ALREADY_REGISTERED,
          message: `Task with name "${sequenceDefinition.name}" is already registered`,
          data: { sequenceId: sequenceDefinition.name },
        }),
      );
    });
  });

  describe('getSequence', () => {
    it('should retrieve a registered sequence', () => {
      const sequenceDefinition = {
        name: 'sequence-1',
        firstTaskId: 'task-1',
        tasks: [],
        errorHandler: {} as any,
        successHandler: {} as any,
      };

      sequenceRegistry.registerSequence(sequenceDefinition);

      const sequence = sequenceRegistry.getSequence(sequenceDefinition.name);

      expect(sequence).toEqual({
        name: sequenceDefinition.name,
        firstTaskId: sequenceDefinition.firstTaskId,
        errorHandler: sequenceDefinition.errorHandler,
        successHandler: sequenceDefinition.successHandler,
      });
    });

    it('should throw an ApiException if the sequence is not found', () => {
      expect(() =>
        sequenceRegistry.getSequence('non-existent-sequence'),
      ).toThrow(Error);
    });
  });

  describe('hasSequence', () => {
    it('should return true if a sequence is registered', () => {
      const sequenceDefinition = {
        name: 'sequence-1',
        firstTaskId: 'task-1',
        tasks: [],
        errorHandler: {} as any,
        successHandler: {} as any,
      };

      sequenceRegistry.registerSequence(sequenceDefinition);

      expect(sequenceRegistry.hasSequence(sequenceDefinition.name)).toBe(true);
    });

    it('should return false if a sequence is not registered', () => {
      expect(sequenceRegistry.hasSequence('non-existent-sequence')).toBe(false);
    });
  });
});
