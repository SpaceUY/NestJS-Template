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

  setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  abstract startConsuming(
    queue: string,
    callback: (payload: unknown, ctx: MessageContext) => Promise<void>,
  ): Promise<void>;

  abstract stopConsuming(queue: string): Promise<void>;
}
