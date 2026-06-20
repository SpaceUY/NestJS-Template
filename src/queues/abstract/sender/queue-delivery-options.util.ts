import { QueueDeliveryOptions } from './queue-sender.interfaces';
import { QueueSenderError, QUEUE_SENDER_ERRORS } from './queue-sender.error';

/**
 * Enforces the "honor or throw" contract for delivery options: any option set on
 * the envelope that the adapter does not list as supported raises
 * `UNSUPPORTED_OPTION`, so a request an adapter can't fulfil (e.g. a delay it
 * would silently ignore) fails loudly instead of misbehaving.
 */
export function assertSupportedDeliveryOptions(
  options: QueueDeliveryOptions | undefined,
  supported: ReadonlyArray<keyof QueueDeliveryOptions>,
  adapter: string,
): void {
  if (!options) return;

  for (const key of Object.keys(options) as (keyof QueueDeliveryOptions)[]) {
    if (options[key] === undefined) continue;
    if (!supported.includes(key)) {
      throw new QueueSenderError(
        QUEUE_SENDER_ERRORS.UNSUPPORTED_OPTION,
        `${adapter} does not support the "${key}" delivery option`,
        { adapter, option: key },
      );
    }
  }
}
