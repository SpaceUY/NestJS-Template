import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BullmqAdapterModule } from './bullmq-adapter.module';
import { BullmqProducerService } from './bullmq-producer.service';
import { getQueueProducerToken } from '../abstract/queue.tokens';

describe('BullmqAdapterModule', () => {
  it('should register the BullMQ connection import in forRoot', () => {
    const moduleRef = BullmqAdapterModule.forRoot();

    expect(moduleRef.module).toBe(BullmqAdapterModule);
    expect(moduleRef.imports).toHaveLength(1);
  });

  it('should bind a producer factory to the queue token in forFeature', async () => {
    const queueName = 'spaceship-notifications';
    const token = getQueueProducerToken(queueName);
    const moduleRef = BullmqAdapterModule.forFeature(queueName);

    const provider = (
      moduleRef.providers as Array<{
        provide: unknown;
        inject: unknown[];
        useFactory: (queue: Queue) => BullmqProducerService;
      }>
    ).find((p) => p.provide === token);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockQueue = { add: jest.fn() } as any;
    const resolved = provider?.useFactory(mockQueue);

    expect(moduleRef.module).toBe(BullmqAdapterModule);
    expect(provider?.provide).toBe(token);
    expect(provider?.inject).toEqual([getQueueToken(queueName)]);
    expect(resolved).toBeInstanceOf(BullmqProducerService);
    expect(moduleRef.exports).toContain(token);
  });
});
