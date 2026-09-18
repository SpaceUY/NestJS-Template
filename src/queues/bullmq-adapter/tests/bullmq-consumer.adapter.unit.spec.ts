/* eslint-disable @typescript-eslint/no-explicit-any */
import { UnrecoverableError, Worker } from 'bullmq';
import { BullMqConsumerAdapter } from '../bullmq-consumer.adapter';
import { BullMqMessageContext } from '../bullmq-message.context';
import { MessageContext } from '../../abstract/consumer/queue-consumer.interfaces';
import { QUEUE_CONSUMER_ERRORS } from '../../abstract/consumer/queue-consumer.error';

const mockWorkerClose = jest.fn().mockResolvedValue(undefined);
let capturedProcessor: (job: any) => Promise<void>;
let workerInstance: any;

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation((_name, processor) => {
    capturedProcessor = processor;
    workerInstance = { on: jest.fn(), close: mockWorkerClose };
    return workerInstance;
  }),
  UnrecoverableError: class UnrecoverableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'UnrecoverableError';
    }
  },
}));

const connection = { host: 'localhost', port: 6379 };

function makeAdapter(
  overrides: Partial<
    ConstructorParameters<typeof BullMqConsumerAdapter>[0]
  > = {},
): BullMqConsumerAdapter {
  return new BullMqConsumerAdapter({ connection, ...overrides } as any);
}

const job = {
  id: 'j1',
  name: 'message',
  attemptsMade: 0,
  data: { payload: { id: 1 }, headers: { traceId: 'abc' } },
} as any;

async function startWith(callback: any, overrides = {}): Promise<void> {
  const adapter = makeAdapter(overrides);
  await adapter.startConsuming('orders', callback);
}

describe('BullMqConsumerAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('start', () => {
    it('creates a worker with the connection, prefix and concurrency', async () => {
      await startWith(
        jest.fn(async () => {}),
        { prefix: 'app', concurrency: 5 },
      );

      expect(Worker).toHaveBeenCalledWith('orders', expect.any(Function), {
        connection,
        prefix: 'app',
        concurrency: 5,
      });
      expect(workerInstance.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
    });

    it('ignores a duplicate start for the same queue', async () => {
      const adapter = makeAdapter();
      await adapter.startConsuming(
        'orders',
        jest.fn(async () => {}),
      );
      await adapter.startConsuming(
        'orders',
        jest.fn(async () => {}),
      );

      expect(Worker).toHaveBeenCalledTimes(1);
    });
  });

  describe('processor outcome (emulated ack/nack)', () => {
    it('delivers payload + context and completes on success', async () => {
      const callback = jest.fn(async () => {});
      await startWith(callback);

      await expect(capturedProcessor(job)).resolves.toBeUndefined();

      const [payload, ctx] = callback.mock.calls[0] as unknown as [
        unknown,
        MessageContext,
      ];
      expect(payload).toEqual({ id: 1 });
      expect(ctx).toBeInstanceOf(BullMqMessageContext);
      expect(ctx.messageId).toBe('j1');
      expect(ctx.headers).toEqual({ traceId: 'abc' });
      expect(ctx.deliveryCount).toBe(1); // attemptsMade (0) + 1
    });

    it('completes when the handler acks explicitly', async () => {
      await startWith(
        jest.fn(async (_p: unknown, ctx: MessageContext) => {
          await ctx.ack();
        }),
      );

      await expect(capturedProcessor(job)).resolves.toBeUndefined();
    });

    it('fails the job (for retry) when the handler throws', async () => {
      await startWith(
        jest.fn(async () => {
          throw new Error('handler boom');
        }),
      );

      await expect(capturedProcessor(job)).rejects.toThrow('handler boom');
    });

    it('throws a retryable error on nack with default requeue', async () => {
      await startWith(
        jest.fn(async (_p: unknown, ctx: MessageContext) => {
          await ctx.nack();
        }),
      );

      const error = await capturedProcessor(job).catch((e) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(UnrecoverableError);
      expect(error.message).toContain('nacked for retry');
    });

    it('throws UnrecoverableError on nack with requeue: false', async () => {
      await startWith(
        jest.fn(async (_p: unknown, ctx: MessageContext) => {
          await ctx.nack({ requeue: false });
        }),
      );

      await expect(capturedProcessor(job)).rejects.toBeInstanceOf(
        UnrecoverableError,
      );
    });

    it('treats an unwrapped job as a raw payload with empty headers', async () => {
      const callback = jest.fn(async () => {});
      await startWith(callback);

      await capturedProcessor({ id: 'j2', data: { id: 9 } } as any);

      const [payload, ctx] = callback.mock.calls[0] as unknown as [
        unknown,
        MessageContext,
      ];
      expect(payload).toEqual({ id: 9 });
      expect(ctx.headers).toEqual({});
    });
  });

  describe('stop', () => {
    it('closes the worker and clears the registration', async () => {
      const adapter = makeAdapter();
      await adapter.startConsuming(
        'orders',
        jest.fn(async () => {}),
      );

      await adapter.stopConsuming('orders');

      expect(mockWorkerClose).toHaveBeenCalledTimes(1);
      expect((adapter as any).workers.has('orders')).toBe(false);
    });

    it('stopConsuming on an unknown queue is a no-op', async () => {
      const adapter = makeAdapter();
      await expect(adapter.stopConsuming('nope')).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('throws CONSUME_FAILED when the worker cannot be created', async () => {
      (Worker as unknown as jest.Mock).mockImplementationOnce(() => {
        throw new Error('no connection');
      });
      const adapter = makeAdapter();

      await expect(
        adapter.startConsuming(
          'orders',
          jest.fn(async () => {}),
        ),
      ).rejects.toMatchObject({
        code: QUEUE_CONSUMER_ERRORS.CONSUME_FAILED,
        data: { queue: 'orders', cause: 'no connection' },
      });
    });
  });
});
