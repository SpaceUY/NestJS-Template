import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueueAbstractModule } from './queue-abstract.module';
import { getQueueProducerToken } from './queue.tokens';
import { BullmqProducerService } from '../bullmq-adapter/bullmq-producer.service';
import { RabbitmqProducerService } from '../rabbitmq-adapter/rabbitmq-producer.service';
import { redisScope } from '../../redis.scope';
import { rabbitmqScope } from '../rabbitmq-adapter/config/rabbitmq.scope';
import { LoggerService } from '../../common/logger/abstract/logger.service';

// Compiles the real Nest module graph (unlike the .unit.spec shape-only test) to catch export/DI-wiring mistakes Nest only surfaces on actual resolution.
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Worker: jest.fn(),
  FlowProducer: jest.fn(),
}));

jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue({
    createConfirmChannel: jest.fn().mockResolvedValue({
      assertQueue: jest.fn().mockResolvedValue(undefined),
      sendToQueue: jest.fn(),
    }),
  }),
}));

@Global()
@Module({
  providers: [
    {
      provide: redisScope.KEY,
      useValue: { host: 'localhost', port: 6379, password: '' },
    },
    {
      provide: rabbitmqScope.KEY,
      useValue: { url: 'amqp://localhost:5672' },
    },
    {
      provide: LoggerService,
      useValue: { setContext: jest.fn(), warn: jest.fn() },
    },
  ],
  exports: [redisScope.KEY, rabbitmqScope.KEY, LoggerService],
})
class TestConfigModule {}

describe('QueueAbstractModule — real NestJS DI resolution', () => {
  const queueName = 'boot-test-queue';
  const token = getQueueProducerToken(queueName);
  const originalAdapter = process.env.QUEUE_ADAPTER;

  afterEach(() => {
    if (originalAdapter === undefined) {
      delete process.env.QUEUE_ADAPTER;
    } else {
      process.env.QUEUE_ADAPTER = originalAdapter;
    }
  });

  it('boots and resolves a real BullmqProducerService when QUEUE_ADAPTER=BULLMQ', async () => {
    process.env.QUEUE_ADAPTER = 'BULLMQ';

    const moduleRef = await Test.createTestingModule({
      imports: [
        TestConfigModule,
        QueueAbstractModule.forRoot(),
        QueueAbstractModule.forFeature(queueName),
      ],
    }).compile();

    const producer = moduleRef.get(token);
    expect(producer).toBeInstanceOf(BullmqProducerService);

    await moduleRef.close();
  });

  it('boots and resolves a real RabbitmqProducerService when QUEUE_ADAPTER=RABBITMQ', async () => {
    process.env.QUEUE_ADAPTER = 'RABBITMQ';

    const moduleRef = await Test.createTestingModule({
      imports: [
        TestConfigModule,
        QueueAbstractModule.forRoot(),
        QueueAbstractModule.forFeature(queueName),
      ],
    }).compile();

    const producer = moduleRef.get(token);
    expect(producer).toBeInstanceOf(RabbitmqProducerService);

    await moduleRef.close();
  });
});
