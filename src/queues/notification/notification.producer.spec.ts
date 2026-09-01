import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { SpaceshipNotificationProducer } from './notification.producer';
import {
  SPACESHIP_NOTIFICATION_QUEUE,
  SPACESHIP_CREATED_JOB,
} from './notification.constants';

describe('SpaceshipNotificationProducer', () => {
  let producer: SpaceshipNotificationProducer;

  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpaceshipNotificationProducer,
        {
          provide: getQueueToken(SPACESHIP_NOTIFICATION_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    producer = module.get<SpaceshipNotificationProducer>(
      SpaceshipNotificationProducer,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('enqueues the spaceship-created job with the minimal payload and retry/backoff options', async () => {
    const data = {
      spaceshipUuid: 'ship-uuid-1',
      name: 'Falcon',
      fleet: 'Alpha',
    };

    await producer.enqueueSpaceshipCreated(data);

    expect(mockQueue.add).toHaveBeenCalledWith(SPACESHIP_CREATED_JOB, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  });
});
