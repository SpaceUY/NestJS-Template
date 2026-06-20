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
