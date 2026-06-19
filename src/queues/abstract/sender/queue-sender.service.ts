import { QueueEnvelope } from './queue-sender.interfaces';
import { LoggerService } from '../../../common/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../../common/logger/nest-adapter/nest-logger.adapter';

/**
 * Contract all queue sender adapters must implement to work alongside the
 * `QueueSenderModule`. The abstract class doubles as the NestJS injection
 * token, consistent with the other abstract modules in this template.
 */
export abstract class QueueSenderService {
  protected logger: LoggerService = new NestLoggerAdapter(
    this.constructor.name,
  );

  setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  /**
   * Fire-and-forget shorthand for publishing a payload to a queue.
   */
  abstract send(queue: string, payload: unknown): Promise<void>;

  /**
   * Advanced path for when headers or other envelope metadata are needed.
   */
  abstract dispatch(envelope: QueueEnvelope): Promise<void>;
}
