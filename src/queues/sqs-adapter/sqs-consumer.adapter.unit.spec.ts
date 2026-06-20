/* eslint-disable @typescript-eslint/no-explicit-any */
import { SqsConsumerAdapter } from './sqs-consumer.adapter';
import { SqsMessageContext } from './sqs-message.context';
import {
  MessageContext,
  ConsumerRegistration,
} from '../abstract/consumer/queue-consumer.interfaces';
import { QUEUE_CONSUMER_ERRORS } from '../abstract/consumer/queue-consumer.error';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  GetQueueUrlCommand: jest.fn().mockImplementation((input) => input),
  ReceiveMessageCommand: jest.fn().mockImplementation((input) => input),
  DeleteMessageCommand: jest.fn().mockImplementation((input) => input),
  ChangeMessageVisibilityCommand: jest
    .fn()
    .mockImplementation((input) => input),
}));

let nextReceive: { Messages?: any[] } = {};

function wireRouter(): void {
  mockSend.mockImplementation(async (input: any) => {
    if ('QueueName' in input) {
      return { QueueUrl: `https://sqs.test/${input.QueueName}` };
    }
    if ('MaxNumberOfMessages' in input) return nextReceive; // ReceiveMessage
    return {}; // Delete / ChangeMessageVisibility
  });
}

function deleteCalls(): any[] {
  return mockSend.mock.calls
    .map((c) => c[0])
    .filter((i) => 'ReceiptHandle' in i && !('VisibilityTimeout' in i));
}

function changeVisibilityCalls(): any[] {
  return mockSend.mock.calls
    .map((c) => c[0])
    .filter((i) => 'ReceiptHandle' in i && 'VisibilityTimeout' in i);
}

function makeAdapter(
  overrides: Partial<ConstructorParameters<typeof SqsConsumerAdapter>[0]> = {},
): SqsConsumerAdapter {
  return new SqsConsumerAdapter({ region: 'us-east-1', ...overrides });
}

const message = {
  MessageId: 'm1',
  ReceiptHandle: 'rh-1',
  Body: JSON.stringify({ id: 1 }),
  MessageAttributes: { traceId: { DataType: 'String', StringValue: 'abc' } },
};

describe('SqsConsumerAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nextReceive = {};
    wireRouter();
  });

  describe('message handling', () => {
    it('delivers the parsed payload and a context, then acks on success', async () => {
      const adapter = makeAdapter();
      const callback = jest.fn(async () => {});
      nextReceive = { Messages: [message] };

      await (adapter as any)._pollOnce('https://sqs.test/orders', callback);

      const [payload, ctx] = callback.mock.calls[0] as unknown as [
        unknown,
        MessageContext,
      ];
      expect(payload).toEqual({ id: 1 });
      expect(ctx).toBeInstanceOf(SqsMessageContext);
      expect(ctx.messageId).toBe('m1');
      expect(ctx.headers).toEqual({ traceId: 'abc' });
      expect(deleteCalls()).toHaveLength(1);
      expect(changeVisibilityCalls()).toHaveLength(0);
    });

    it('exposes the delivery count from ApproximateReceiveCount', async () => {
      const adapter = makeAdapter();
      const callback = jest.fn(async () => {});
      nextReceive = {
        Messages: [
          { ...message, Attributes: { ApproximateReceiveCount: '3' } },
        ],
      };

      await (adapter as any)._pollOnce('https://sqs.test/orders', callback);

      const ctx = (callback.mock.calls[0] as unknown[])[1] as MessageContext;
      expect(ctx.deliveryCount).toBe(3);
    });

    it('nacks (immediate redelivery) when the handler throws', async () => {
      const adapter = makeAdapter();
      const callback = jest.fn(async () => {
        throw new Error('handler boom');
      });
      nextReceive = { Messages: [message] };

      await (adapter as any)._pollOnce('https://sqs.test/orders', callback);

      expect(deleteCalls()).toHaveLength(0);
      expect(changeVisibilityCalls()).toHaveLength(1);
      expect(changeVisibilityCalls()[0].VisibilityTimeout).toBe(0);
    });

    it('skips the implicit ack when the handler acks explicitly', async () => {
      const adapter = makeAdapter();
      const callback = jest.fn(
        async (_payload: unknown, ctx: MessageContext) => {
          await ctx.ack();
        },
      );
      nextReceive = { Messages: [message] };

      await (adapter as any)._pollOnce('https://sqs.test/orders', callback);

      expect(deleteCalls()).toHaveLength(1);
      expect(changeVisibilityCalls()).toHaveLength(0);
    });

    it('does nothing extra when the handler nacks with requeue: false', async () => {
      const adapter = makeAdapter();
      const callback = jest.fn(
        async (_payload: unknown, ctx: MessageContext) => {
          await ctx.nack({ requeue: false });
        },
      );
      nextReceive = { Messages: [message] };

      await (adapter as any)._pollOnce('https://sqs.test/orders', callback);

      expect(deleteCalls()).toHaveLength(0);
      expect(changeVisibilityCalls()).toHaveLength(0);
    });

    it('passes a non-JSON body through as a raw string', async () => {
      const adapter = makeAdapter();
      const callback = jest.fn(async () => {});
      nextReceive = { Messages: [{ ...message, Body: 'plain-text' }] };

      await (adapter as any)._pollOnce('https://sqs.test/orders', callback);

      expect((callback.mock.calls[0] as unknown[])[0]).toBe('plain-text');
    });
  });

  describe('lifecycle', () => {
    it('resolves the queue URL on start and clears the consumer on stop', async () => {
      const adapter = makeAdapter();
      nextReceive = { Messages: [] };

      await adapter.startConsuming(
        'orders',
        jest.fn(async () => {}),
      );

      expect(
        mockSend.mock.calls.filter((c) => 'QueueName' in c[0]),
      ).toHaveLength(1);
      expect((adapter as any).consumers.has('orders')).toBe(true);

      await adapter.stopConsuming('orders');

      expect((adapter as any).consumers.has('orders')).toBe(false);
    });

    it('ignores a duplicate start for the same queue', async () => {
      const adapter = makeAdapter();
      nextReceive = { Messages: [] };

      await adapter.startConsuming(
        'orders',
        jest.fn(async () => {}),
      );
      await adapter.startConsuming(
        'orders',
        jest.fn(async () => {}),
      );

      expect(
        mockSend.mock.calls.filter((c) => 'QueueName' in c[0]),
      ).toHaveLength(1);

      await adapter.stopConsuming('orders');
    });

    it('stopConsuming on an unknown queue is a no-op', async () => {
      const adapter = makeAdapter();

      await expect(adapter.stopConsuming('nope')).resolves.toBeUndefined();
    });

    it('throws CONSUME_FAILED when the queue URL cannot be resolved', async () => {
      mockSend.mockRejectedValue(new Error('no such queue'));
      const adapter = makeAdapter();

      await expect(
        adapter.startConsuming(
          'missing',
          jest.fn(async () => {}),
        ),
      ).rejects.toMatchObject({
        code: QUEUE_CONSUMER_ERRORS.CONSUME_FAILED,
        data: { queue: 'missing', cause: 'no such queue' },
      });
    });
  });

  // Ensures the adapter satisfies the abstract registration contract shape.
  it('exposes the methods the consumer module wires', () => {
    const adapter = makeAdapter();
    const registration: ConsumerRegistration = {
      queue: 'orders',
      handler: class {} as any,
    };

    expect(typeof adapter.startConsuming).toBe('function');
    expect(typeof adapter.stopConsuming).toBe('function');
    expect(registration.queue).toBe('orders');
  });
});
