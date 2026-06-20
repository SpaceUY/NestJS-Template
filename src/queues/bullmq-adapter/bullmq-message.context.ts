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

  private _outcome: 'ack' | 'nack' | null = null;
  private _requeue = true;

  constructor(job: Job, headers: Record<string, string>) {
    this.messageId = job.id;
    this.headers = headers;
  }

  get wasAcknowledged(): boolean {
    return this._outcome !== null;
  }

  get nacked(): boolean {
    return this._outcome === 'nack';
  }

  get requeue(): boolean {
    return this._requeue;
  }

  async ack(): Promise<void> {
    this._outcome = 'ack';
  }

  async nack(opts?: { requeue?: boolean }): Promise<void> {
    this._outcome = 'nack';
    this._requeue = opts?.requeue ?? true;
  }
}
