import { GetQueueUrlCommand, SQSClient } from '@aws-sdk/client-sqs';

/**
 * Resolves an SQS queue name to its URL, memoizing the result in the provided
 * cache so repeated sends/polls don't re-hit `GetQueueUrl`. Throws the raw SDK
 * error — callers wrap it in their domain error with the right code.
 *
 * @param {SQSClient} client - SQS client used to look up the queue URL.
 * @param {string} queueName - Queue name to resolve.
 * @param {Map<string, string>} cache - Name-to-URL cache, read on hit and populated on miss.
 * @returns {Promise<string>} The resolved SQS queue URL.
 * @throws {Error} The raw SDK error if the lookup fails, or a plain error if
 *   SQS returns no URL for the queue.
 */
export async function resolveQueueUrl(
  client: SQSClient,
  queueName: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(queueName);
  if (cached) return cached;

  const response = await client.send(
    new GetQueueUrlCommand({ QueueName: queueName }),
  );

  const url = response.QueueUrl;
  if (!url) {
    throw new Error(`SQS returned no URL for queue "${queueName}"`);
  }

  cache.set(queueName, url);
  return url;
}
