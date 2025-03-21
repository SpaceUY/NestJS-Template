import { SequenceRegistry } from '../../providers/sequence.registry';
import { MockLogger } from './logger.mock';

export class MockSequenceRegistry extends SequenceRegistry {
  constructor() {
    super(new MockLogger());
  }

  public getSequence = jest.fn();
  public registerSequence = jest.fn();
  public hasSequence = jest.fn();
}
