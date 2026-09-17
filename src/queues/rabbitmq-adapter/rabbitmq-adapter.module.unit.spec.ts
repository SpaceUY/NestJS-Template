import { RabbitmqAdapterModule } from './rabbitmq-adapter.module';
import { RabbitmqProducerService } from './rabbitmq-producer.service';
import { getQueueProducerToken } from '../abstract/queue.tokens';
import { RABBITMQ_CHANNEL } from './rabbitmq.tokens';
import { LoggerService } from '../../common/logger/abstract/logger.service';

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
        useFactory: (
          channel: unknown,
          logger: unknown,
        ) => Promise<RabbitmqProducerService>;
      }>
    ).find((p) => p.provide === token);

    const mockChannel = {
      assertQueue: jest.fn().mockResolvedValue(undefined),
      sendToQueue: jest.fn(),
    };
    const mockLogger = { setContext: jest.fn(), warn: jest.fn() };
    const resolved = await provider?.useFactory(mockChannel, mockLogger);

    expect(moduleRef.module).toBe(RabbitmqAdapterModule);
    expect(provider?.provide).toBe(token);
    expect(provider?.inject).toEqual([RABBITMQ_CHANNEL, LoggerService]);
    expect(mockChannel.assertQueue).toHaveBeenCalledWith(queueName, {
      durable: true,
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'RabbitMQ queue registered with no built-in consumer support',
        data: expect.objectContaining({ queueName }),
      }),
    );
    expect(resolved).toBeInstanceOf(RabbitmqProducerService);
    expect(moduleRef.exports).toContain(token);
  });
});
