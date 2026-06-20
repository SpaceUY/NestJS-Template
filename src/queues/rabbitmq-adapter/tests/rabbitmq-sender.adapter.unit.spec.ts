/* eslint-disable @typescript-eslint/no-explicit-any */
import { connect } from 'amqplib';
import { RabbitMqSenderAdapter } from '../rabbitmq-sender.adapter';
import { RABBITMQ_RESERVED_HEADERS } from '../rabbitmq-adapter.interfaces';
import { QUEUE_SENDER_ERRORS } from '../../abstract/sender/queue-sender.error';

jest.mock('amqplib', () => ({ connect: jest.fn() }));

const mockConnect = connect as jest.Mock;

let mockChannel: any;
let mockConnection: any;

function wireHappyPath(): void {
  // Confirm-channel publishes take a callback that the broker invokes on
  // ack (no error) / nack (error); the happy path acks immediately.
  mockChannel = {
    assertQueue: jest.fn().mockResolvedValue({}),
    assertExchange: jest.fn().mockResolvedValue({}),
    sendToQueue: jest.fn((_queue, _content, _options, confirm) => {
      confirm?.(null);
      return true;
    }),
    publish: jest.fn((_exchange, _routingKey, _content, _options, confirm) => {
      confirm?.(null);
      return true;
    }),
  };
  mockConnection = {
    createConfirmChannel: jest.fn().mockResolvedValue(mockChannel),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };
  mockConnect.mockResolvedValue(mockConnection);
}

function makeAdapter(
  overrides: Partial<
    ConstructorParameters<typeof RabbitMqSenderAdapter>[0]
  > = {},
): RabbitMqSenderAdapter {
  return new RabbitMqSenderAdapter({ url: 'amqp://localhost', ...overrides });
}

describe('RabbitMqSenderAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wireHappyPath();
  });

  describe('send (default exchange)', () => {
    it('asserts a durable queue and publishes the JSON payload', async () => {
      const adapter = makeAdapter();

      await adapter.send('orders', { id: 1 });

      expect(mockChannel.assertQueue).toHaveBeenCalledWith('orders', {
        durable: true,
      });
      const [queue, content, options] = mockChannel.sendToQueue.mock.calls[0];
      expect(queue).toBe('orders');
      expect(content.toString()).toBe(JSON.stringify({ id: 1 }));
      expect(options).toEqual({ headers: {}, persistent: true });
    });

    it('forwards non-reserved headers as message headers', async () => {
      const adapter = makeAdapter();

      await adapter.dispatch({
        queue: 'orders',
        payload: { id: 1 },
        headers: { traceId: 'abc' },
      });

      expect(mockChannel.sendToQueue.mock.calls[0][2].headers).toEqual({
        traceId: 'abc',
      });
    });

    it('skips assertQueue when assertTopology is false', async () => {
      const adapter = makeAdapter({ assertTopology: false });

      await adapter.send('orders', { id: 1 });

      expect(mockChannel.assertQueue).not.toHaveBeenCalled();
      expect(mockChannel.sendToQueue).toHaveBeenCalled();
    });

    it('memoizes the connection and channel across sends', async () => {
      const adapter = makeAdapter();

      await adapter.send('orders', { id: 1 });
      await adapter.send('orders', { id: 2 });

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(mockConnection.createConfirmChannel).toHaveBeenCalledTimes(1);
      expect(mockChannel.assertQueue).toHaveBeenCalledTimes(1); // cached
    });
  });

  describe('exchange routing', () => {
    it('routes dispatch through an exchange via reserved headers', async () => {
      const adapter = makeAdapter();

      await adapter.dispatch({
        queue: 'unused',
        payload: { id: 1 },
        headers: {
          [RABBITMQ_RESERVED_HEADERS.EXCHANGE]: 'orders',
          [RABBITMQ_RESERVED_HEADERS.ROUTING_KEY]: 'order.created',
          traceId: 'abc',
        },
      });

      expect(mockChannel.sendToQueue).not.toHaveBeenCalled();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'orders',
        'topic',
        { durable: true },
      );
      const [exchange, routingKey, content, options] =
        mockChannel.publish.mock.calls[0];
      expect(exchange).toBe('orders');
      expect(routingKey).toBe('order.created');
      expect(content.toString()).toBe(JSON.stringify({ id: 1 }));
      // Reserved headers are stripped; only real headers remain.
      expect(options.headers).toEqual({ traceId: 'abc' });
    });

    it('publishToExchange asserts the exchange with the given type and publishes', async () => {
      const adapter = makeAdapter();

      await adapter.publishToExchange({
        exchange: 'events',
        routingKey: 'user.signup',
        payload: { id: 1 },
        type: 'direct',
      });

      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'events',
        'direct',
        { durable: true },
      );
      expect(mockChannel.publish.mock.calls[0][0]).toBe('events');
      expect(mockChannel.publish.mock.calls[0][1]).toBe('user.signup');
    });

    it('caches exchange assertions', async () => {
      const adapter = makeAdapter();

      await adapter.publishToExchange({ exchange: 'events', payload: 1 });
      await adapter.publishToExchange({ exchange: 'events', payload: 2 });

      expect(mockChannel.assertExchange).toHaveBeenCalledTimes(1);
    });
  });

  describe('delivery options', () => {
    it('passes priority into the publish options', async () => {
      const adapter = makeAdapter();

      await adapter.dispatch({
        queue: 'orders',
        payload: { id: 1 },
        options: { priority: 5 },
      });

      expect(mockChannel.sendToQueue.mock.calls[0][2]).toEqual({
        headers: {},
        persistent: true,
        priority: 5,
      });
    });

    it('throws UNSUPPORTED_OPTION for delay', async () => {
      const adapter = makeAdapter();

      await expect(
        adapter.dispatch({
          queue: 'orders',
          payload: {},
          options: { delay: 1000 },
        }),
      ).rejects.toMatchObject({
        code: QUEUE_SENDER_ERRORS.UNSUPPORTED_OPTION,
        data: { option: 'delay' },
      });
    });
  });

  describe('error handling', () => {
    it('throws CONNECTION_FAILED when connecting fails', async () => {
      mockConnect.mockRejectedValue(new Error('econnrefused'));
      const adapter = makeAdapter();

      await expect(adapter.send('orders', {})).rejects.toMatchObject({
        code: QUEUE_SENDER_ERRORS.CONNECTION_FAILED,
        data: { cause: 'econnrefused' },
      });
    });

    it('throws SEND_FAILED when publishing throws', async () => {
      mockChannel.sendToQueue.mockImplementation(() => {
        throw new Error('channel closed');
      });
      const adapter = makeAdapter();

      await expect(adapter.send('orders', {})).rejects.toMatchObject({
        code: QUEUE_SENDER_ERRORS.SEND_FAILED,
        data: { target: 'orders', cause: 'channel closed' },
      });
    });

    it('throws SEND_FAILED when the broker nacks the message', async () => {
      mockChannel.sendToQueue.mockImplementation(
        (_queue, _content, _options, confirm) => {
          confirm(new Error('broker nack'));
          return true;
        },
      );
      const adapter = makeAdapter();

      await expect(adapter.send('orders', {})).rejects.toMatchObject({
        code: QUEUE_SENDER_ERRORS.SEND_FAILED,
        data: { target: 'orders', cause: 'broker nack' },
      });
    });
  });
});
