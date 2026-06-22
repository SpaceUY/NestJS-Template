/* eslint-disable @typescript-eslint/no-explicit-any */
import { Buffer } from 'node:buffer';
import { connect } from 'amqplib';
import { RabbitMqConsumerAdapter } from '../rabbitmq-consumer.adapter';
import { RabbitMqMessageContext } from '../rabbitmq-message.context';
import { MessageContext } from '../../abstract/consumer/queue-consumer.interfaces';
import { QUEUE_CONSUMER_ERRORS } from '../../abstract/consumer/queue-consumer.error';

jest.mock('amqplib', () => ({ connect: jest.fn() }));

const mockConnect = connect as jest.Mock;

let mockChannel: any;
let mockConnection: any;

function wireHappyPath(): void {
  mockChannel = {
    assertQueue: jest.fn().mockResolvedValue({}),
    prefetch: jest.fn().mockResolvedValue({}),
    consume: jest.fn().mockResolvedValue({ consumerTag: 'ctag-1' }),
    cancel: jest.fn().mockResolvedValue({}),
    close: jest.fn().mockResolvedValue(undefined),
    ack: jest.fn(),
    nack: jest.fn(),
    on: jest.fn(),
  };
  mockConnection = {
    createChannel: jest.fn().mockResolvedValue(mockChannel),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };
  mockConnect.mockResolvedValue(mockConnection);
}

function makeAdapter(
  overrides: Partial<
    ConstructorParameters<typeof RabbitMqConsumerAdapter>[0]
  > = {},
): RabbitMqConsumerAdapter {
  return new RabbitMqConsumerAdapter({ url: 'amqp://localhost', ...overrides });
}

const message = {
  content: Buffer.from(JSON.stringify({ id: 1 })),
  properties: { messageId: 'm1', headers: { traceId: 'abc' } },
  fields: { deliveryTag: 1 },
} as any;

describe('RabbitMqConsumerAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wireHappyPath();
  });

  describe('message handling', () => {
    it('delivers the parsed payload and a context, then acks on success', async () => {
      const adapter = makeAdapter();
      const callback = jest.fn(async () => {});

      await (adapter as any)._handleMessage(mockChannel, message, callback);

      const [payload, ctx] = callback.mock.calls[0] as unknown as [
        unknown,
        MessageContext,
      ];
      expect(payload).toEqual({ id: 1 });
      expect(ctx).toBeInstanceOf(RabbitMqMessageContext);
      expect(ctx.messageId).toBe('m1');
      expect(ctx.headers).toEqual({ traceId: 'abc' });
      expect(mockChannel.ack).toHaveBeenCalledWith(message);
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it('derives deliveryCount from the x-death header', async () => {
      const adapter = makeAdapter();
      const callback = jest.fn(async () => {});
      const redelivered = {
        ...message,
        properties: { messageId: 'm1', headers: { 'x-death': [{ count: 2 }] } },
      };

      await (adapter as any)._handleMessage(mockChannel, redelivered, callback);

      const ctx = (callback.mock.calls[0] as unknown[])[1] as MessageContext;
      expect(ctx.deliveryCount).toBe(3);
    });

    it('nacks with requeue when the handler throws', async () => {
      const adapter = makeAdapter();
      const callback = jest.fn(async () => {
        throw new Error('handler boom');
      });

      await (adapter as any)._handleMessage(mockChannel, message, callback);

      expect(mockChannel.ack).not.toHaveBeenCalled();
      expect(mockChannel.nack).toHaveBeenCalledWith(message, false, true);
    });

    it('skips the implicit ack when the handler acks explicitly', async () => {
      const adapter = makeAdapter();
      const callback = jest.fn(
        async (_payload: unknown, ctx: MessageContext) => {
          await ctx.ack();
        },
      );

      await (adapter as any)._handleMessage(mockChannel, message, callback);

      expect(mockChannel.ack).toHaveBeenCalledTimes(1);
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it('honors explicit nack with requeue: false', async () => {
      const adapter = makeAdapter();
      const callback = jest.fn(
        async (_payload: unknown, ctx: MessageContext) => {
          await ctx.nack({ requeue: false });
        },
      );

      await (adapter as any)._handleMessage(mockChannel, message, callback);

      expect(mockChannel.nack).toHaveBeenCalledWith(message, false, false);
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it('passes a non-JSON body through as a raw string', async () => {
      const adapter = makeAdapter();
      const callback = jest.fn(async () => {});
      const rawMessage = { ...message, content: Buffer.from('plain-text') };

      await (adapter as any)._handleMessage(mockChannel, rawMessage, callback);

      expect((callback.mock.calls[0] as unknown[])[0]).toBe('plain-text');
    });
  });

  describe('lifecycle', () => {
    it('asserts the queue, sets prefetch, and consumes on start', async () => {
      const adapter = makeAdapter({ prefetch: 5 });

      await adapter.startConsuming(
        'orders',
        jest.fn(async () => {}),
      );

      expect(mockChannel.assertQueue).toHaveBeenCalledWith('orders', {
        durable: true,
      });
      expect(mockChannel.prefetch).toHaveBeenCalledWith(5);
      expect(mockChannel.consume).toHaveBeenCalledWith(
        'orders',
        expect.any(Function),
      );
      expect((adapter as any).consumers.has('orders')).toBe(true);
    });

    it('skips assertQueue when assertTopology is false', async () => {
      const adapter = makeAdapter({ assertTopology: false });

      await adapter.startConsuming(
        'orders',
        jest.fn(async () => {}),
      );

      expect(mockChannel.assertQueue).not.toHaveBeenCalled();
      expect(mockChannel.consume).toHaveBeenCalled();
    });

    it('routes delivered messages to the handler and ignores null deliveries', async () => {
      const adapter = makeAdapter();
      const callback = jest.fn(async () => {});

      await adapter.startConsuming('orders', callback);
      const onMessage = mockChannel.consume.mock.calls[0][1];

      await onMessage(null);
      expect(callback).not.toHaveBeenCalled();

      await onMessage(message);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(mockChannel.ack).toHaveBeenCalledWith(message);
    });

    it('cancels and closes the channel on stop', async () => {
      const adapter = makeAdapter();

      await adapter.startConsuming(
        'orders',
        jest.fn(async () => {}),
      );
      await adapter.stopConsuming('orders');

      expect(mockChannel.cancel).toHaveBeenCalledWith('ctag-1');
      expect(mockChannel.close).toHaveBeenCalled();
      expect((adapter as any).consumers.has('orders')).toBe(false);
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

      expect(mockConnection.createChannel).toHaveBeenCalledTimes(1);
    });

    it('stopConsuming on an unknown queue is a no-op', async () => {
      const adapter = makeAdapter();

      await expect(adapter.stopConsuming('nope')).resolves.toBeUndefined();
    });

    it('throws CONSUME_FAILED when the channel cannot be created', async () => {
      mockConnection.createChannel.mockRejectedValue(new Error('no channel'));
      const adapter = makeAdapter();

      await expect(
        adapter.startConsuming(
          'orders',
          jest.fn(async () => {}),
        ),
      ).rejects.toMatchObject({
        code: QUEUE_CONSUMER_ERRORS.CONSUME_FAILED,
        data: { queue: 'orders', cause: 'no channel' },
      });
    });

    it('closes the connection on module destroy', async () => {
      const adapter = makeAdapter();
      await adapter.startConsuming(
        'orders',
        jest.fn(async () => {}),
      );

      await adapter.onModuleDestroy();

      expect(mockConnection.close).toHaveBeenCalledTimes(1);
    });

    it('module destroy is a no-op when nothing was ever connected', async () => {
      const adapter = makeAdapter();

      await adapter.onModuleDestroy();

      expect(mockConnection.close).not.toHaveBeenCalled();
    });
  });

  describe('channel recovery', () => {
    // The adapter registers an 'error' and a 'close' listener per channel; this
    // pulls the latest 'close' handler the mock recorded.
    function latestCloseHandler(): () => void {
      const closeCalls = mockChannel.on.mock.calls.filter(
        (call: any[]) => call[0] === 'close',
      );
      return closeCalls[closeCalls.length - 1][1];
    }

    it('deregisters the consumer when its channel closes unexpectedly', async () => {
      const adapter = makeAdapter();
      await adapter.startConsuming(
        'orders',
        jest.fn(async () => {}),
      );
      expect((adapter as any).consumers.has('orders')).toBe(true);

      latestCloseHandler()();

      expect((adapter as any).consumers.has('orders')).toBe(false);
    });

    it('resume() re-subscribes a halted queue with the stored callback', async () => {
      const adapter = makeAdapter();
      const callback = jest.fn(async () => {});
      await adapter.startConsuming('orders', callback);

      latestCloseHandler()();
      expect((adapter as any).consumers.has('orders')).toBe(false);

      await adapter.resume('orders');

      expect((adapter as any).consumers.has('orders')).toBe(true);
      expect(mockConnection.createChannel).toHaveBeenCalledTimes(2);
    });

    it('resume() with no argument resumes every halted queue', async () => {
      const adapter = makeAdapter();
      await adapter.startConsuming(
        'orders',
        jest.fn(async () => {}),
      );
      latestCloseHandler()();
      await adapter.startConsuming(
        'emails',
        jest.fn(async () => {}),
      );
      latestCloseHandler()();

      await adapter.resume();

      expect((adapter as any).consumers.has('orders')).toBe(true);
      expect((adapter as any).consumers.has('emails')).toBe(true);
    });

    it('resume() skips a queue that is still active', async () => {
      const adapter = makeAdapter();
      await adapter.startConsuming(
        'orders',
        jest.fn(async () => {}),
      );

      await adapter.resume('orders');

      expect(mockConnection.createChannel).toHaveBeenCalledTimes(1);
    });

    it('does not resume a queue after an intentional stop', async () => {
      const adapter = makeAdapter();
      await adapter.startConsuming(
        'orders',
        jest.fn(async () => {}),
      );
      await adapter.stopConsuming('orders');

      await adapter.resume('orders');

      expect((adapter as any).consumers.has('orders')).toBe(false);
    });
  });
});
