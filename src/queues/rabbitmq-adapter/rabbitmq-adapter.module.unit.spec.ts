import { RabbitmqAdapterModule } from './rabbitmq-adapter.module';
import { RabbitmqProducerService } from './rabbitmq-producer.service';
import { getQueueProducerToken } from '../abstract/queue.tokens';
import { RABBITMQ_CHANNEL } from './rabbitmq.tokens';

describe('RabbitmqAdapterModule', () => {
  it('should register the RabbitMQ connection/channel providers in forRoot', () => {
    const moduleRef = RabbitmqAdapterModule.forRoot();

    expect(moduleRef.module).toBe(RabbitmqAdapterModule);
    expect(moduleRef.global).toBe(true);
    expect(moduleRef.providers).toHaveLength(2);
    expect(moduleRef.exports).toEqual([
      'RABBITMQ_CONNECTION',
      'RABBITMQ_CHANNEL',
    ]);
  });

  it('should bind a producer factory to the queue token in forFeature', async () => {
    const queueName = 'spaceship-notifications';
    const token = getQueueProducerToken(queueName);
    const moduleRef = RabbitmqAdapterModule.forFeature(queueName);

    const provider = (
      moduleRef.providers as Array<{
        provide: unknown;
        inject: unknown[];
        useFactory: (channel: unknown) => Promise<RabbitmqProducerService>;
      }>
    ).find((p) => p.provide === token);

    const mockChannel = {
      assertQueue: jest.fn().mockResolvedValue(undefined),
      sendToQueue: jest.fn(),
    };
    const resolved = await provider?.useFactory(mockChannel);

    expect(moduleRef.module).toBe(RabbitmqAdapterModule);
    expect(provider?.provide).toBe(token);
    expect(provider?.inject).toEqual([RABBITMQ_CHANNEL]);
    expect(mockChannel.assertQueue).toHaveBeenCalledWith(queueName, {
      durable: true,
    });
    expect(resolved).toBeInstanceOf(RabbitmqProducerService);
    expect(moduleRef.exports).toContain(token);
  });
});
