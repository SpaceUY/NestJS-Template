export const QUEUE_SENDER_ERRORS = {
  SEND_FAILED: 'QUEUE_SENDER_SEND_FAILED',
  DISPATCH_FAILED: 'QUEUE_SENDER_DISPATCH_FAILED',
  CONNECTION_FAILED: 'QUEUE_SENDER_CONNECTION_FAILED',
  UNSUPPORTED_OPTION: 'QUEUE_SENDER_UNSUPPORTED_OPTION',
} as const;

export type QueueSenderErrorCode =
  (typeof QUEUE_SENDER_ERRORS)[keyof typeof QUEUE_SENDER_ERRORS];

export class QueueSenderError extends Error {
  /**
   * Creates a sender error tagged with a machine-readable code.
   *
   * @param {QueueSenderErrorCode} code - Stable error code identifying the failure.
   * @param {string} message - Human-readable error message.
   * @param {Record<string, unknown>} [data] - Optional structured context (queue, option, cause, …).
   */
  constructor(
    public readonly code: QueueSenderErrorCode,
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'QueueSenderError';
  }
}
