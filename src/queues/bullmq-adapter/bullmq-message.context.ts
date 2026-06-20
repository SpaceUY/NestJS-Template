import { Job } from 'bullmq';
import { MessageContext } from '../abstract/consumer/queue-consumer.interfaces';

/**
 * Concrete `MessageContext` for BullMQ.
 *
 * BullMQ has no ack/nack — a job is completed when the processor resolves and
 * failed when it throws. So `ack`/`nack` here only *record intent*; the consumer
 * adapter reads that intent after the handler returns and resolves or throws the
 * processor accordingly.
 */
export class BullMqMessageContext implements MessageContext {
  readonly messageId?: string;
  readonly headers: Record<string, string>;
  readonly deliveryCount?: number;

  private _outcome: 'ack' | 'nack' | null = null;
  private _requeue = true;

  /**
   * Builds the context from a BullMQ job and its unwrapped headers.
   *
   * @param {Job} job - The BullMQ job being processed; supplies the message id and attempt count.
   * @param {Record<string, string>} headers - Header metadata extracted from the job envelope.
   */
  constructor(job: Job, headers: Record<string, string>) {
    this.messageId = job.id;
    this.headers = headers;
    // attemptsMade is 0 on the first run; +1 makes it a 1-based delivery count.
    this.deliveryCount = job.attemptsMade + 1;
  }

  /** Whether an outcome (ack or nack) has been recorded for this message. */
  get wasAcknowledged(): boolean {
    return this._outcome !== null;
  }

  /** Whether the recorded outcome was a nack. */
  get nacked(): boolean {
    return this._outcome === 'nack';
  }

  /** Whether a nacked message should be requeued for retry. */
  get requeue(): boolean {
    return this._requeue;
  }

  /**
   * Records intent to acknowledge the message.
   *
   * BullMQ has no native ack; the consumer adapter reads this intent and resolves the job processor.
   *
   * @returns {Promise<void>} Resolves immediately once the ack intent is recorded.
   */
  async ack(): Promise<void> {
    this._outcome = 'ack';
  }

  /**
   * Records intent to negatively acknowledge the message.
   *
   * BullMQ has no native nack; the consumer adapter reads this intent and throws from the job processor.
   * When `requeue` is false, it throws `UnrecoverableError` so remaining retries are skipped.
   *
   * @param {{ requeue?: boolean }} [opts] - Options controlling retry behavior; `requeue` defaults to `true`.
   * @returns {Promise<void>} Resolves immediately once the nack intent is recorded.
   */
  async nack(opts?: { requeue?: boolean }): Promise<void> {
    this._outcome = 'nack';
    this._requeue = opts?.requeue ?? true;
  }
}
