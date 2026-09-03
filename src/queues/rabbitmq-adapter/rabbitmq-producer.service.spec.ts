import { RabbitmqProducerService } from './rabbitmq-producer.service';

describe('RabbitmqProducerService', () => {
  let service: RabbitmqProducerService;
  const mockChannel = {
    sendToQueue: jest.fn(
      (
        _queue: string,
        _payload: Buffer,
        _options: unknown,
        callback: (error: Error | null) => void,
      ) => {
        callback(null);
        return true;
      },
    ),
  };

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new RabbitmqProducerService(mockChannel as any, 'test-queue');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('publishes the job as a JSON payload with metadata headers for attempts/backoff/delay', async () => {
    const result = await service.enqueue(
      'spaceship-created',
      { spaceshipUuid: 'ship-uuid-1' },
      {
        attempts: 3,
        delayMs: 1000,
        backoff: { type: 'exponential', delayMs: 5000 },
      },
    );

    expect(mockChannel.sendToQueue).toHaveBeenCalledTimes(1);
    const [queueName, payload, options] = mockChannel.sendToQueue.mock
      .calls[0] as [string, Buffer, Record<string, unknown>, unknown];

    expect(queueName).toBe('test-queue');
    expect(JSON.parse(payload.toString())).toEqual({
      jobName: 'spaceship-created',
      data: { spaceshipUuid: 'ship-uuid-1' },
    });
    expect(options).toEqual({
      persistent: true,
      messageId: result.id,
      headers: {
        'x-attempts': 3,
        'x-delay-ms': 1000,
        'x-backoff-type': 'exponential',
        'x-backoff-delay-ms': 5000,
      },
    });
  });

  it('publishes with no metadata headers when options are omitted', async () => {
    const result = await service.enqueue('spaceship-created', {
      spaceshipUuid: 'ship-uuid-2',
    });

    const [, , options] = mockChannel.sendToQueue.mock.calls[0] as [
      string,
      Buffer,
      Record<string, unknown>,
      unknown,
    ];
    expect(options).toEqual({
      persistent: true,
      messageId: result.id,
      headers: {},
    });
  });

  it('returns a generated id that is also used as the AMQP message id', async () => {
    const result = await service.enqueue('spaceship-created', {});

    const [, , options] = mockChannel.sendToQueue.mock.calls[0] as [
      string,
      Buffer,
      Record<string, unknown>,
      unknown,
    ];
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
    expect((options as { messageId: string }).messageId).toBe(result.id);
  });

  it('does not resolve until the broker confirms the publish', async () => {
    let capturedCallback: ((error: Error | null) => void) | undefined;
    mockChannel.sendToQueue.mockImplementationOnce(
      (_queue, _payload, _options, callback) => {
        capturedCallback = callback;
        return true;
      },
    );

    const pending = service.enqueue('spaceship-created', {});
    let settled = false;
    pending.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    capturedCallback?.(null);
    await pending;
    expect(settled).toBe(true);
  });

  it('rejects when the broker does not confirm the publish', async () => {
    const brokerError = new Error('channel closed');
    mockChannel.sendToQueue.mockImplementationOnce(
      (_queue, _payload, _options, callback) => {
        callback(brokerError);
        return true;
      },
    );

    await expect(service.enqueue('spaceship-created', {})).rejects.toThrow(
      brokerError,
    );
  });
});
