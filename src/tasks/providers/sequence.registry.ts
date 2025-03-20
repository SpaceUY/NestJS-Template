// ===== Types =====
import type { SequenceDefinition as FullSequenceDefinition } from "@/modules/core/tasks/background/task-sequence.module";
import type { PinoLogger } from "nestjs-pino";

// ===== Common =====
import { ERROR_CODES } from "@/common/enums/error-codes.enum";

import { ApiException } from "@/common/expections/api.exception";
import { Injectable } from "@nestjs/common";

type SequenceDefinition = Omit<FullSequenceDefinition, "tasks">;

@Injectable()
export class SequenceRegistry {
  private _sequences: Map<string, SequenceDefinition> = new Map();

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(SequenceRegistry.name);
  }

  /**
   * Register a sequence definition in the registry
   * @param {FullSequenceDefinition} sequenceDefinition - The sequence definition to register
   */
  registerSequence(sequenceDefinition: FullSequenceDefinition): void {
    // Avoid registering the tasks in the registry. There's a separate registry for tasks.
    const { tasks, ...definition } = sequenceDefinition;

    if (this.hasSequence(definition.name)) {
      throw new Error(
        `Task with name "${definition.name}" is already registered`,
      );
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
   */
  private _getSequenceDefinition(sequenceName: string): SequenceDefinition {
    const sequenceDef = this._sequences.get(sequenceName);

    if (!sequenceDef) {
      throw new ApiException({
        code: ERROR_CODES.SEQUENCE_NOT_FOUND,
        data: { sequenceId: sequenceName },
      });
    }

    return sequenceDef;
  }
}
