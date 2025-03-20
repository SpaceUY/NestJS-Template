import { SequenceRegistry } from "@/modules/core/tasks/background/providers/sequence.registry";
import { MockLogger } from "@/modules/infrastructure/logger/tests/mocks/logger.mock";

export class MockSequenceRegistry extends SequenceRegistry {
  constructor() {
    super(new MockLogger());
  }

  public getSequence = jest.fn();
  public registerSequence = jest.fn();
  public hasSequence = jest.fn();
};
