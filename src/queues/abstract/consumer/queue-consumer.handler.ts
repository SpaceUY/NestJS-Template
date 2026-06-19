import { MessageContext } from './queue-consumer.interfaces';

/**
 * Contract for application-defined message handlers — one class per queue.
 *
 * Handlers are registered as NestJS providers, so they can inject any service
 * from the container through their constructor. Throw from `handle` to trigger
 * the adapter's implicit nack, or call `ctx.nack()` for explicit control.
 */
export abstract class QueueConsumerHandler<TPayload = unknown> {
  abstract handle(payload: TPayload, ctx: MessageContext): Promise<void>;
}
