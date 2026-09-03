export function getQueueProducerToken(queueName: string): string {
  return `QueueProducer_${queueName}`;
}
