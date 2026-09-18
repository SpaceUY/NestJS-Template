export const QUEUE_PRODUCER_ERRORS = {
  SEND_FAILED: 'QUEUE_PRODUCER_SEND_FAILED',
  DISPATCH_FAILED: 'QUEUE_PRODUCER_DISPATCH_FAILED',
  CONNECTION_FAILED: 'QUEUE_PRODUCER_CONNECTION_FAILED',
  UNSUPPORTED_OPTION: 'QUEUE_PRODUCER_UNSUPPORTED_OPTION',
} as const;

export type QueueProducerErrorCode =
  (typeof QUEUE_PRODUCER_ERRORS)[keyof typeof QUEUE_PRODUCER_ERRORS];

export class QueueProducerError extends Error {
  /**
   * Creates a producer error tagged with a machine-readable code.
   *
   * @param {QueueProducerErrorCode} code - Stable error code identifying the failure.
   * @param {string} message - Human-readable error message.
   * @param {Record<string, unknown>} [data] - Optional structured context (queue, option, cause, …).
   */
  constructor(
    public readonly code: QueueProducerErrorCode,
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'QueueProducerError';
  }
}
