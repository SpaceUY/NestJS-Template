import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueueAbstractModule } from './queue-abstract.module';
import { getQueueProducerToken } from './queue.tokens';
import { BullmqProducerService } from '../bullmq-adapter/bullmq-producer.service';
import { RabbitmqProducerService } from '../rabbitmq-adapter/rabbitmq-producer.service';
import { bullmqRedisScope } from '../bullmq-adapter/config/bullmq-redis.scope';
import { rabbitmqScope } from '../rabbitmq-adapter/config/rabbitmq.scope';

// This spec compiles the REAL NestJS module graph produced by
// QueueAbstractModule (unlike queue-abstract.module.unit.spec.ts, which
// only inspects the returned DynamicModule shape). It exists specifically
// to catch export/DI-wiring mistakes that only surface when Nest actually
// validates and resolves the module graph — e.g. re-exporting a raw token
// from a child module instead of the module itself, which Nest's exports
// validation rejects at compile time but a shape-only test cannot see.
//
// bullmq's Queue and amqplib's connect() are mocked so this stays a real
// DI test without requiring a live Redis or RabbitMQ broker.
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
      provide: bullmqRedisScope.KEY,
      useValue: { host: 'localhost', port: 6379, password: '' },
    },
    {
      provide: rabbitmqScope.KEY,
      useValue: { url: 'amqp://localhost:5672' },
    },
  ],
  exports: [bullmqRedisScope.KEY, rabbitmqScope.KEY],
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
