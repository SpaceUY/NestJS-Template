export const QUEUE_CONSUMER_ERRORS = {
  CONSUME_FAILED: 'QUEUE_CONSUMER_CONSUME_FAILED',
  ACK_FAILED: 'QUEUE_CONSUMER_ACK_FAILED',
  NACK_FAILED: 'QUEUE_CONSUMER_NACK_FAILED',
  HANDLER_ERROR: 'QUEUE_CONSUMER_HANDLER_ERROR',
} as const;

export type QueueConsumerErrorCode =
  (typeof QUEUE_CONSUMER_ERRORS)[keyof typeof QUEUE_CONSUMER_ERRORS];

export class QueueConsumerError extends Error {
  /**
   * Creates a consumer error tagged with a machine-readable code.
   *
   * @param {QueueConsumerErrorCode} code - Stable error code identifying the failure.
   * @param {string} message - Human-readable error message.
   * @param {Record<string, unknown>} [data] - Optional structured context (queue, message id, cause, …).
   */
  constructor(
    public readonly code: QueueConsumerErrorCode,
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'QueueConsumerError';
  }
}
