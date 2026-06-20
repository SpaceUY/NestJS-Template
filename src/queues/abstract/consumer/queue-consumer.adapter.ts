import { MessageContext } from './queue-consumer.interfaces';
import { LoggerService } from '../../../common/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../../common/logger/nest-adapter/nest-logger.adapter';

/**
 * Contract all queue consumer adapters must implement. Responsible for
 * connecting to the broker, receiving raw messages, building a concrete
 * `MessageContext` per message, invoking the registered callback, and handling
 * implicit acknowledgment.
 *
 * Implicit acknowledgment (adapter responsibility):
 * - callback resolves and neither `ack()` nor `nack()` was called → `ack()`
 * - callback rejects and neither was called → `nack()`
 * - `ack()`/`nack()` called explicitly → adapter skips the implicit call
 */
export abstract class QueueConsumerAdapter {
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
   * Begins consuming a queue, delivering each message to the callback and
   * applying the implicit acknowledgment contract described on this class.
   *
   * @param {string} queue - Queue name to consume from.
   * @param {(payload: unknown, ctx: MessageContext) => Promise<void>} callback - Handler invoked with the parsed payload and per-message context.
   * @returns {Promise<void>} Resolves once consumption has been set up.
   */
  abstract startConsuming(
    queue: string,
    callback: (payload: unknown, ctx: MessageContext) => Promise<void>,
  ): Promise<void>;

  /**
   * Stops consuming a queue and releases its broker resources.
   *
   * @param {string} queue - Queue name to stop consuming.
   * @returns {Promise<void>} Resolves once consumption has fully stopped.
   */
  abstract stopConsuming(queue: string): Promise<void>;
}
