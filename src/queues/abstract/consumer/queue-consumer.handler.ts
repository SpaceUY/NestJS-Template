import { MessageContext } from './queue-consumer.interfaces';

/**
 * Contract for application-defined message handlers — one class per queue.
 *
 * Handlers are registered as NestJS providers, so they can inject any service
 * from the container through their constructor. Throw from `handle` to trigger
 * the adapter's implicit nack, or call `ctx.nack()` for explicit control.
 *
 * Handlers must be singleton-scoped (the default). The module resolves them once
 * at startup via `ModuleRef.get`, which does not support request- or
 * transient-scoped providers.
 */
export abstract class QueueConsumerHandler<TPayload = unknown> {
  /**
   * Processes a single message from the bound queue.
   *
   * Returning resolves the message (implicit ack); throwing triggers the
   * adapter's implicit nack. Use `ctx` for explicit ack/nack control.
   *
   * @param {TPayload} payload - The deserialized message payload.
   * @param {MessageContext} ctx - Per-message context exposing metadata and explicit ack/nack.
   * @returns {Promise<void>} Resolves once the message has been handled.
   */
  abstract handle(payload: TPayload, ctx: MessageContext): Promise<void>;
}
