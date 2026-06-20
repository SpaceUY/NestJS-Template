/* eslint-disable @typescript-eslint/no-explicit-any */
import { SQSClient } from '@aws-sdk/client-sqs';
import { SqsSenderAdapter } from '../sqs-sender.adapter';
import { SQS_RESERVED_HEADERS } from '../sqs-adapter.interfaces';
import {
  QueueSenderError,
  QUEUE_SENDER_ERRORS,
} from '../../abstract/sender/queue-sender.error';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  GetQueueUrlCommand: jest.fn().mockImplementation((input) => input),
  SendMessageCommand: jest.fn().mockImplementation((input) => input),
}));

// Default behavior: GetQueueUrl resolves a URL from the name, SendMessage
// resolves a message id.
function wireHappyPath(): void {
  mockSend.mockImplementation(async (input: any) => {
    if ('QueueName' in input) {
      return { QueueUrl: `https://sqs.test/${input.QueueName}` };
    }
    return { MessageId: 'mid-1' };
  });
}

function lastSendMessage(): any {
  const calls = mockSend.mock.calls.map((c) => c[0]);
  return [...calls].reverse().find((input) => 'MessageBody' in input);
}

function makeAdapter(
  overrides: Partial<ConstructorParameters<typeof SqsSenderAdapter>[0]> = {},
): SqsSenderAdapter {
  return new SqsSenderAdapter({ region: 'us-east-1', ...overrides });
}

describe('SqsSenderAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wireHappyPath();
  });

  describe('send', () => {
    it('resolves the queue URL and publishes the JSON payload', async () => {
      const adapter = makeAdapter();

      await adapter.send('orders', { id: 1 });

      const message = lastSendMessage();
      expect(message.QueueUrl).toBe('https://sqs.test/orders');
      expect(message.MessageBody).toBe(JSON.stringify({ id: 1 }));
    });

    it('caches the resolved queue URL across calls', async () => {
      const adapter = makeAdapter();

      await adapter.send('orders', { id: 1 });
      await adapter.send('orders', { id: 2 });

      const getUrlCalls = mockSend.mock.calls.filter(
        (c) => 'QueueName' in c[0],
      );
      expect(getUrlCalls).toHaveLength(1);
    });
  });

  describe('delivery options', () => {
    it('maps delay to DelaySeconds', async () => {
      const adapter = makeAdapter();

      await adapter.dispatch({
        queue: 'orders',
        payload: { id: 1 },
        options: { delay: 5000 },
      });

      expect(lastSendMessage().DelaySeconds).toBe(5);
    });

    it('throws UNSUPPORTED_OPTION for priority', async () => {
      const adapter = makeAdapter();

      await expect(
        adapter.dispatch({
          queue: 'orders',
          payload: {},
          options: { priority: 1 },
        }),
      ).rejects.toMatchObject({
        code: QUEUE_SENDER_ERRORS.UNSUPPORTED_OPTION,
        data: { option: 'priority' },
      });
    });

    it('throws DISPATCH_FAILED when delay exceeds the 15 minute cap', async () => {
      const adapter = makeAdapter();

      await expect(
        adapter.dispatch({
          queue: 'orders',
          payload: {},
          options: { delay: 900_001 },
        }),
      ).rejects.toMatchObject({ code: QUEUE_SENDER_ERRORS.DISPATCH_FAILED });
    });
  });

  describe('dispatch', () => {
    it('maps non-reserved headers to message attributes', async () => {
      const adapter = makeAdapter();

      await adapter.dispatch({
        queue: 'orders',
        payload: { id: 1 },
        headers: { traceId: 'abc' },
      });

      expect(lastSendMessage().MessageAttributes).toEqual({
        traceId: { DataType: 'String', StringValue: 'abc' },
      });
    });

    it('routes FIFO headers to native SQS params, not attributes', async () => {
      const adapter = makeAdapter();

      await adapter.dispatch({
        queue: 'orders.fifo',
        payload: { id: 1 },
        headers: {
          [SQS_RESERVED_HEADERS.MESSAGE_GROUP_ID]: 'group-1',
          [SQS_RESERVED_HEADERS.MESSAGE_DEDUPLICATION_ID]: 'dedup-1',
          traceId: 'abc',
        },
      });

      const message = lastSendMessage();
      expect(message.MessageGroupId).toBe('group-1');
      expect(message.MessageDeduplicationId).toBe('dedup-1');
      expect(message.MessageAttributes).toEqual({
        traceId: { DataType: 'String', StringValue: 'abc' },
      });
    });

    it('throws DISPATCH_FAILED for a FIFO queue without a group id', async () => {
      const adapter = makeAdapter();

      await expect(
        adapter.dispatch({ queue: 'orders.fifo', payload: { id: 1 } }),
      ).rejects.toMatchObject({
        code: QUEUE_SENDER_ERRORS.DISPATCH_FAILED,
      });
    });
  });

  describe('error handling', () => {
    it('throws CONNECTION_FAILED when the queue URL cannot be resolved', async () => {
      mockSend.mockRejectedValue(new Error('no such queue'));
      const adapter = makeAdapter();

      await expect(adapter.send('missing', {})).rejects.toMatchObject({
        code: QUEUE_SENDER_ERRORS.CONNECTION_FAILED,
        data: { queue: 'missing', cause: 'no such queue' },
      });
    });

    it('throws SEND_FAILED when publishing fails', async () => {
      mockSend.mockImplementation(async (input: any) => {
        if ('QueueName' in input) {
          return { QueueUrl: `https://sqs.test/${input.QueueName}` };
        }
        throw new Error('send boom');
      });
      const adapter = makeAdapter();

      await expect(adapter.send('orders', {})).rejects.toBeInstanceOf(
        QueueSenderError,
      );
      await expect(adapter.send('orders', {})).rejects.toMatchObject({
        code: QUEUE_SENDER_ERRORS.SEND_FAILED,
        data: { queue: 'orders', cause: 'send boom' },
      });
    });
  });

  describe('client construction', () => {
    it('passes explicit credentials and endpoint to the SDK client', () => {
      makeAdapter({
        accessKeyId: 'key-id',
        secretAccessKey: 'key-secret',
        endpoint: 'http://localhost:4566',
      });

      expect(SQSClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1',
          endpoint: 'http://localhost:4566',
          credentials: { accessKeyId: 'key-id', secretAccessKey: 'key-secret' },
        }),
      );
    });

    it('omits credentials when not provided', () => {
      makeAdapter();

      expect(SQSClient).toHaveBeenCalledWith(
        expect.not.objectContaining({ credentials: expect.anything() }),
      );
    });
  });
});
