import { Inject, Injectable } from "@nestjs/common";
import type { SequenceDefinition as FullSequenceDefinition } from "../task-sequence.module";
import { ERROR_CODES } from "../constants/error-codes";
import { TASK_LOGGER } from "../constants/tokens";
import { TaskLogger } from "../interfaces/logger.interface";

type SequenceDefinition = Omit<FullSequenceDefinition, "tasks">;

@Injectable()
export class SequenceRegistry {
  private _sequences: Map<string, SequenceDefinition> = new Map();

  constructor(@Inject(TASK_LOGGER) private readonly logger: TaskLogger) {
    this.logger.setContext(SequenceRegistry.name);
  }

  /**
   * Register a sequence definition in the registry
   * @param {FullSequenceDefinition} sequenceDefinition - The sequence definition to register
   * @throws {Error} - If the sequence is already registered.
   */
  registerSequence(sequenceDefinition: FullSequenceDefinition): void {
    // Avoid registering the tasks in the registry. There's a separate registry for tasks.
    const { tasks, ...definition } = sequenceDefinition;

    if (this.hasSequence(definition.name)) {
      throw new Error(JSON.stringify({
        code: ERROR_CODES.TASK_ALREADY_REGISTERED,
        message: `Task with name "${definition.name}" is already registered`,
        data: { sequenceId: definition.name },
      }));
    }

    this._sequences.set(definition.name, definition);

    this.logger.info({
      message: "Task sequence registered",
      data: {
        sequenceName: definition.name,
        tasks: tasks.map(task => task.id),
      },
    });
  }

  /**
   * Get a sequence from the registry by its name.
   * @param {string} sequenceName - The name of the sequence to retrieve.
   * @returns {SequenceDefinition} - The sequence definition.
   * @throws {Error} - If the sequence is not found.
   */
  getSequence(sequenceName: string): SequenceDefinition {
    return this._getSequenceDefinition(sequenceName);
  }

  /**
   * Check if a sequence exists in the registry.
   * @param {string} sequenceName - The name of the sequence to check.
   * @returns {boolean}
   */
  hasSequence(sequenceName: string): boolean {
    return this._sequences.has(sequenceName);
  }

  /**
   * Get a sequence definition the registry by its name.
   * @param {string} sequenceName - The name of the sequence to retrieve.
   * @returns {SequenceDefinition} - The sequence definition.
   * @throws {Error} - If the sequence is not found.
   */
  private _getSequenceDefinition(sequenceName: string): SequenceDefinition {
    const sequenceDef = this._sequences.get(sequenceName);

    if (!sequenceDef) {
      throw new Error(JSON.stringify({
        code: ERROR_CODES.SEQUENCE_NOT_FOUND,
        message: `Sequence with name "${sequenceName}" is not registered`,
        data: { sequenceId: sequenceName },
      }));
    }

    return sequenceDef;
  }
}
