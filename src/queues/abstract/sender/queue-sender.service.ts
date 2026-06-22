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

  /**
   * Replaces the default logger, letting the module inject the container's
   * `LoggerService` after instantiation.
   *
   * @param {LoggerService} logger - Logger the adapter should use from now on.
   */
  setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  /**
   * Fire-and-forget shorthand for publishing a payload to a queue.
   *
   * @param {string} queue - Destination queue name.
   * @param {unknown} payload - Message body to publish.
   * @returns {Promise<void>} Resolves once the message has been published.
   */
  abstract send(queue: string, payload: unknown): Promise<void>;

  /**
   * Advanced path for when headers or other envelope metadata are needed.
   *
   * @param {QueueEnvelope} envelope - Queue name, payload, optional headers and delivery options.
   * @returns {Promise<void>} Resolves once the message has been published.
   */
  abstract dispatch(envelope: QueueEnvelope): Promise<void>;
}
