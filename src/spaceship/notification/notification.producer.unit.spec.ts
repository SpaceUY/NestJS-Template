import { Test, TestingModule } from '@nestjs/testing';
import { SpaceshipNotificationProducer } from './notification.producer';
import { BullMqSenderAdapter } from '../../queues/bullmq-adapter/bullmq-sender.adapter';
import {
  SPACESHIP_NOTIFICATION_QUEUE,
  SPACESHIP_CREATED_JOB,
  SPACESHIP_NOTIFICATION_MAX_ATTEMPTS,
} from './notification.constants';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';

describe('SpaceshipNotificationProducer', () => {
  let producer: SpaceshipNotificationProducer;

  const mockSender = { addJob: jest.fn() };
  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpaceshipNotificationProducer,
        { provide: BullMqSenderAdapter, useValue: mockSender },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    producer = module.get<SpaceshipNotificationProducer>(
      SpaceshipNotificationProducer,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('enqueues the spaceship-created job with the job type header and retry/backoff options', async () => {
    const data = {
      spaceshipUuid: 'ship-uuid-1',
      name: 'Falcon',
      fleet: 'Alpha',
    };
    mockSender.addJob.mockResolvedValue(undefined);

    await producer.enqueueSpaceshipCreated(data);

    expect(mockSender.addJob).toHaveBeenCalledWith({
      queue: SPACESHIP_NOTIFICATION_QUEUE,
      payload: data,
      headers: { jobType: SPACESHIP_CREATED_JOB },
      options: {
        attempts: SPACESHIP_NOTIFICATION_MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: 5000 },
      },
    });
  });

  it('logs the enqueue with the spaceship uuid', async () => {
    const data = {
      spaceshipUuid: 'ship-uuid-1',
      name: 'Falcon',
      fleet: 'Alpha',
    };
    mockSender.addJob.mockResolvedValue(undefined);

    await producer.enqueueSpaceshipCreated(data);

    expect(mockLogger.log).toHaveBeenCalledWith({
      message: 'Spaceship-created notification enqueued',
      data: { spaceshipUuid: 'ship-uuid-1' },
    });
  });
});
