/**
 * Shared connection options for the SQS adapters. Credentials are optional —
 * prefer IAM roles in remote environments and only pass explicit keys for local
 * development against an AWS account, identical to the secrets-manager adapter.
 */
export interface SqsConnectionOptions {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  // Custom endpoint, e.g. a LocalStack/ElasticMQ URL for local development.
  endpoint?: string;
}

export type SqsSenderAdapterOptions = SqsConnectionOptions;

export interface SqsConsumerAdapterOptions extends SqsConnectionOptions {
  // Long-poll wait time per ReceiveMessage call (0-20). Defaults to 20.
  waitTimeSeconds?: number;
  // Max messages pulled per ReceiveMessage call (1-10). Defaults to 10.
  maxNumberOfMessages?: number;
  // Optional per-message visibility timeout (seconds) applied on receive.
  visibilityTimeout?: number;
}

/**
 * Envelope header keys that carry FIFO-specific concerns. They are lifted out of
 * `QueueEnvelope.headers` and mapped to native SQS parameters rather than to
 * message attributes.
 */
export const SQS_RESERVED_HEADERS = {
  MESSAGE_GROUP_ID: 'MessageGroupId',
  MESSAGE_DEDUPLICATION_ID: 'MessageDeduplicationId',
} as const;
