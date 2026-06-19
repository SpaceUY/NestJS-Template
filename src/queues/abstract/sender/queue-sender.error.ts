export const QUEUE_SENDER_ERRORS = {
  SEND_FAILED: 'QUEUE_SENDER_SEND_FAILED',
  DISPATCH_FAILED: 'QUEUE_SENDER_DISPATCH_FAILED',
  CONNECTION_FAILED: 'QUEUE_SENDER_CONNECTION_FAILED',
} as const;

export type QueueSenderErrorCode =
  (typeof QUEUE_SENDER_ERRORS)[keyof typeof QUEUE_SENDER_ERRORS];

export class QueueSenderError extends Error {
  constructor(
    public readonly code: QueueSenderErrorCode,
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'QueueSenderError';
  }
}
