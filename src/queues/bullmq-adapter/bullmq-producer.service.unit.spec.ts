import { BullmqProducerService } from './bullmq-producer.service';
import { QueueError } from '../abstract/queue.error';

describe('BullmqProducerService', () => {
  let service: BullmqProducerService;

  const mockQueue = { add: jest.fn(), name: 'test-queue' };

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new BullmqProducerService(mockQueue as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('translates vendor-agnostic options into BullMQ job options and returns the job id', async () => {
    mockQueue.add.mockResolvedValue({ id: 'job-1' });

    const result = await service.enqueue(
      'spaceship-created',
      { spaceshipUuid: 'ship-uuid-1' },
      {
        attempts: 3,
        delayMs: 1000,
        backoff: { type: 'exponential', delayMs: 5000 },
      },
    );

    expect(mockQueue.add).toHaveBeenCalledWith(
      'spaceship-created',
      { spaceshipUuid: 'ship-uuid-1' },
      {
        attempts: 3,
        delay: 1000,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    expect(result).toEqual({ id: 'job-1' });
  });

  it('enqueues with no backoff when options are omitted', async () => {
    mockQueue.add.mockResolvedValue({ id: 'job-2' });

    const result = await service.enqueue('spaceship-created', {
      spaceshipUuid: 'ship-uuid-2',
    });

    expect(mockQueue.add).toHaveBeenCalledWith(
      'spaceship-created',
      { spaceshipUuid: 'ship-uuid-2' },
      { attempts: undefined, delay: undefined, backoff: undefined },
    );
    expect(result).toEqual({ id: 'job-2' });
  });

  it('translates a rejected queue.add() into a QueueError instead of the raw BullMQ/ioredis error', async () => {
    mockQueue.add.mockRejectedValue(new Error('connection lost'));

    await expect(
      service.enqueue('spaceship-created', { spaceshipUuid: 'ship-uuid-3' }),
    ).rejects.toMatchObject({
      name: 'QueueError',
      code: 'QUEUE_ENQUEUE_FAILED',
      data: { jobName: 'spaceship-created', cause: 'connection lost' },
    });
    await expect(
      service.enqueue('spaceship-created', { spaceshipUuid: 'ship-uuid-3' }),
    ).rejects.toBeInstanceOf(QueueError);
  });
});
