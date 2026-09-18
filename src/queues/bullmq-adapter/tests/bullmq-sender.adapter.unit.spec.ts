/* eslint-disable @typescript-eslint/no-explicit-any */
import { Queue } from 'bullmq';
import { BullMqSenderAdapter } from '../bullmq-sender.adapter';
import { QUEUE_SENDER_ERRORS } from '../../abstract/sender/queue-sender.error';

const mockAdd = jest.fn();
const mockQueueClose = jest.fn().mockResolvedValue(undefined);

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation((name) => ({
    name,
    add: mockAdd,
    close: mockQueueClose,
  })),
}));

const connection = { host: 'localhost', port: 6379 };

function makeAdapter(
  overrides: Partial<ConstructorParameters<typeof BullMqSenderAdapter>[0]> = {},
): BullMqSenderAdapter {
  return new BullMqSenderAdapter({ connection, ...overrides } as any);
}

describe('BullMqSenderAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdd.mockResolvedValue({ id: 'job-1' });
  });

  describe('send / dispatch', () => {
    it('constructs a queue and enqueues a wrapped job', async () => {
      const adapter = makeAdapter({ prefix: 'app' });

      await adapter.send('orders', { id: 1 });

      expect(Queue).toHaveBeenCalledWith('orders', {
        connection,
        prefix: 'app',
      });
      expect(mockAdd).toHaveBeenCalledWith(
        'message',
        { payload: { id: 1 }, headers: {} },
        {},
      );
    });

    it('forwards headers in the job envelope', async () => {
      const adapter = makeAdapter();

      await adapter.dispatch({
        queue: 'orders',
        payload: { id: 1 },
        headers: { traceId: 'abc' },
      });

      expect(mockAdd).toHaveBeenCalledWith(
        'message',
        { payload: { id: 1 }, headers: { traceId: 'abc' } },
        {},
      );
    });

    it('maps delay and priority delivery options to job options', async () => {
      const adapter = makeAdapter();

      await adapter.dispatch({
        queue: 'orders',
        payload: { id: 1 },
        options: { delay: 5000, priority: 3 },
      });

      expect(mockAdd).toHaveBeenCalledWith(
        'message',
        { payload: { id: 1 }, headers: {} },
        { delay: 5000, priority: 3 },
      );
    });

    it('uses a custom jobName when configured', async () => {
      const adapter = makeAdapter({ jobName: 'order-event' });

      await adapter.send('orders', { id: 1 });

      expect(mockAdd).toHaveBeenCalledWith(
        'order-event',
        { payload: { id: 1 }, headers: {} },
        {},
      );
    });

    it('reuses the same Queue instance per queue name', async () => {
      const adapter = makeAdapter();

      await adapter.send('orders', { id: 1 });
      await adapter.send('orders', { id: 2 });

      expect(Queue).toHaveBeenCalledTimes(1);
    });

    it('throws SEND_FAILED when enqueue fails', async () => {
      mockAdd.mockRejectedValue(new Error('redis down'));
      const adapter = makeAdapter();

      await expect(adapter.send('orders', {})).rejects.toMatchObject({
        code: QUEUE_SENDER_ERRORS.SEND_FAILED,
        data: { queue: 'orders', cause: 'redis down' },
      });
    });
  });

  describe('addJob (BullMQ extension)', () => {
    it('passes through BullMQ-specific job options', async () => {
      const adapter = makeAdapter();

      await adapter.addJob({
        queue: 'orders',
        payload: { id: 1 },
        headers: { traceId: 'abc' },
        options: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      });

      expect(mockAdd).toHaveBeenCalledWith(
        'message',
        { payload: { id: 1 }, headers: { traceId: 'abc' } },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('closes all opened queues', async () => {
      const adapter = makeAdapter();
      await adapter.send('orders', { id: 1 });
      await adapter.send('emails', { id: 2 });

      await adapter.onModuleDestroy();

      expect(mockQueueClose).toHaveBeenCalledTimes(2);
    });
  });
});
