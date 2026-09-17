import { DynamicModule } from '@nestjs/common';
import {
  QueueAbstractModule,
  QUEUE_ADAPTERS,
  resolveAdapterModule,
} from './queue-abstract.module';
import { BullmqAdapterModule } from '../bullmq-adapter/bullmq-adapter.module';
import { RabbitmqAdapterModule } from '../rabbitmq-adapter/rabbitmq-adapter.module';
import { getQueueProducerToken } from './queue.tokens';

describe('QueueAbstractModule', () => {
  const originalAdapter = process.env.QUEUE_ADAPTER;

  beforeEach(() => {
    delete process.env.QUEUE_ADAPTER;
  });

  afterEach(() => {
    if (originalAdapter === undefined) {
      delete process.env.QUEUE_ADAPTER;
    } else {
      process.env.QUEUE_ADAPTER = originalAdapter;
    }
  });

  describe('resolveAdapterModule', () => {
    it('should default to BullmqAdapterModule when QUEUE_ADAPTER is unset', () => {
      expect(resolveAdapterModule()).toBe(BullmqAdapterModule);
    });

    it('should resolve BullmqAdapterModule for "BULLMQ" (normalized from lowercase)', () => {
      process.env.QUEUE_ADAPTER = 'bullmq';
      expect(resolveAdapterModule()).toBe(BullmqAdapterModule);
    });

    it('should resolve RabbitmqAdapterModule for "RABBITMQ"', () => {
      process.env.QUEUE_ADAPTER = 'RABBITMQ';
      expect(resolveAdapterModule()).toBe(RabbitmqAdapterModule);
    });

    it('should throw a descriptive error for an unsupported adapter', () => {
      process.env.QUEUE_ADAPTER = 'SQS';

      expect(() => resolveAdapterModule()).toThrow(/SQS/);
      expect(() => resolveAdapterModule()).toThrow(
        new RegExp(QUEUE_ADAPTERS.BULLMQ),
      );
      expect(() => resolveAdapterModule()).toThrow(
        new RegExp(QUEUE_ADAPTERS.RABBITMQ),
      );
    });
  });

  describe('forRoot', () => {
    it('should import BullmqAdapterModule.forRoot() when QUEUE_ADAPTER=BULLMQ', () => {
      process.env.QUEUE_ADAPTER = 'BULLMQ';
      const moduleRef = QueueAbstractModule.forRoot();
      const inner = moduleRef.imports?.[0] as DynamicModule;

      expect(moduleRef.module).toBe(QueueAbstractModule);
      expect(moduleRef.imports).toHaveLength(1);
      expect(inner.module).toBe(BullmqAdapterModule);
    });

    it('should import RabbitmqAdapterModule.forRoot() when QUEUE_ADAPTER=RABBITMQ', () => {
      process.env.QUEUE_ADAPTER = 'RABBITMQ';
      const moduleRef = QueueAbstractModule.forRoot();
      const inner = moduleRef.imports?.[0] as DynamicModule;

      expect(moduleRef.module).toBe(QueueAbstractModule);
      expect(moduleRef.imports).toHaveLength(1);
      expect(inner.module).toBe(RabbitmqAdapterModule);
    });

    it('should throw for an unsupported adapter', () => {
      process.env.QUEUE_ADAPTER = 'SQS';
      expect(() => QueueAbstractModule.forRoot()).toThrow(/SQS/);
    });
  });

  describe('forFeature', () => {
    it('should import and re-export BullmqAdapterModule.forFeature() when QUEUE_ADAPTER=BULLMQ', () => {
      process.env.QUEUE_ADAPTER = 'BULLMQ';
      const queueName = 'test-queue';
      const token = getQueueProducerToken(queueName);
      const moduleRef = QueueAbstractModule.forFeature(queueName);
      const inner = moduleRef.imports?.[0] as DynamicModule;

      expect(moduleRef.module).toBe(QueueAbstractModule);
      expect(moduleRef.imports).toHaveLength(1);
      expect(inner.module).toBe(BullmqAdapterModule);
      expect(inner.exports).toContain(token);
      // The child module itself (not its raw token) must be re-exported —
      // Nest rejects re-exporting a token that isn't declared by this
      // module's own providers or an imported module's class.
      expect(moduleRef.exports).toEqual([inner]);
    });

    it('should import and re-export RabbitmqAdapterModule.forFeature() when QUEUE_ADAPTER=RABBITMQ', () => {
      process.env.QUEUE_ADAPTER = 'RABBITMQ';
      const queueName = 'test-queue';
      const token = getQueueProducerToken(queueName);
      const moduleRef = QueueAbstractModule.forFeature(queueName);
      const inner = moduleRef.imports?.[0] as DynamicModule;

      expect(moduleRef.module).toBe(QueueAbstractModule);
      expect(moduleRef.imports).toHaveLength(1);
      expect(inner.module).toBe(RabbitmqAdapterModule);
      expect(inner.exports).toContain(token);
      expect(moduleRef.exports).toEqual([inner]);
    });

    it('should throw for an unsupported adapter', () => {
      process.env.QUEUE_ADAPTER = 'SQS';
      expect(() => QueueAbstractModule.forFeature('test-queue')).toThrow(/SQS/);
    });
  });
});
