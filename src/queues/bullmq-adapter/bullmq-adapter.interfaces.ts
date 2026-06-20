import { ConnectionOptions } from 'bullmq';

/**
 * Shared options for the BullMQ adapters. `connection` is an ioredis options
 * object (or instance) — the same shape ioredis uses elsewhere in this
 * template. For worker connections BullMQ requires `maxRetriesPerRequest: null`.
 */
export interface BullMqConnectionOptions {
  connection: ConnectionOptions;
  // Optional key prefix for all BullMQ keys in Redis.
  prefix?: string;
}

export type BullMqSenderAdapterOptions = BullMqConnectionOptions;

export interface BullMqConsumerAdapterOptions extends BullMqConnectionOptions {
  // Number of jobs a worker processes in parallel. Defaults to BullMQ's default.
  concurrency?: number;
}

/**
 * Internal job-data envelope. BullMQ jobs have no header slot, so the adapter
 * wraps the payload together with the abstract headers and unwraps on consume.
 */
export interface BullMqJobEnvelope {
  payload: unknown;
  headers: Record<string, string>;
}

/**
 * Curated subset of BullMQ's job options. These are the BullMQ-specific knobs
 * that go beyond the broker-agnostic `QueueDeliveryOptions` (delay/priority) —
 * exposed through the dedicated `addJob` method rather than the abstract
 * `dispatch`, mirroring RabbitMQ's `publishToExchange`. Field names match
 * BullMQ's `JobsOptions` and pass through unchanged.
 */
export interface BullMqJobOptions {
  // Delay before the job becomes active, in milliseconds.
  delay?: number;
  // Higher = processed sooner.
  priority?: number;
  // Total attempts before the job is marked failed.
  attempts?: number;
  // Backoff between attempts: a fixed delay (ms) or a strategy descriptor.
  backoff?: number | { type: string; delay?: number };
  // Explicit job id (enables deduplication — a repeated id is ignored).
  jobId?: string;
  // Process in LIFO order.
  lifo?: boolean;
  // Auto-remove the job on completion / failure (boolean or a keep-count).
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

/**
 * Parameters for the dedicated `addJob` extension on the BullMQ sender.
 */
export interface BullMqAddJobParams {
  queue: string;
  payload: unknown;
  headers?: Record<string, string>;
  options?: BullMqJobOptions;
}
