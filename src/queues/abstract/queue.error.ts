export const QUEUE_ERRORS = {
  ENQUEUE_FAILED: 'QUEUE_ENQUEUE_FAILED',
} as const;

export type QueueErrorCode = (typeof QUEUE_ERRORS)[keyof typeof QUEUE_ERRORS];

export class QueueError extends Error {
  constructor(
    public readonly code: QueueErrorCode,
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'QueueError';
  }
}
