import { Test, TestingModule } from '@nestjs/testing';
import { SpaceshipService } from './spaceship.service';
import { SpaceshipRepository } from './spaceship.repository';
import { SpaceshipNotificationProducer } from './notification/notification.producer';
import { LoggerService } from '../common/observability/logger/abstract/logger.service';
import { CacheService } from '../cache/abstract/cache.service';
import { spaceshipCacheScope } from './config/spaceship-cache.scope';
import { SPACESHIP_LIST_CACHE_KEY } from './spaceship.constants';
import { UpdateSpaceshipDto } from './dto/update-spaceship.dto';

describe('SpaceshipService', () => {
  let service: SpaceshipService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAll: jest.fn(),
    findByUuid: jest.fn(),
    findByUuidOrFail: jest.fn(),
    update: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockNotificationProducer = {
    enqueueSpaceshipCreated: jest.fn(),
  };

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    clear: jest.fn(),
  };

  const mockCacheConfig = { listTtlSeconds: 60 };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpaceshipService,
        { provide: SpaceshipRepository, useValue: mockRepository },
        {
          provide: SpaceshipNotificationProducer,
          useValue: mockNotificationProducer,
        },
        { provide: LoggerService, useValue: mockLogger },
        { provide: CacheService, useValue: mockCache },
        { provide: spaceshipCacheScope.KEY, useValue: mockCacheConfig },
      ],
    }).compile();

    service = module.get<SpaceshipService>(SpaceshipService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSpaceship', () => {
    it('creates and saves a spaceship with captainId', async () => {
      const dto = { name: 'Falcon', fleet: 'Alpha' };
      const userId = 1;
      const entity = { ...dto, captainId: userId };
      const saved = { id: 1, uuid: 'ship-uuid-1', ...entity };

      mockRepository.create.mockReturnValue(entity);
      mockRepository.save.mockResolvedValue(saved);
      mockRepository.findByUuidOrFail.mockResolvedValue(saved);
      mockNotificationProducer.enqueueSpaceshipCreated.mockResolvedValue(
        undefined,
      );

      const result = await service.createSpaceship(dto, userId);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...dto,
        captainId: userId,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(entity);
      expect(result).toEqual(saved);
    });

    it('re-fetches by uuid so the response includes the captain relation', async () => {
      const dto = { name: 'Falcon', fleet: 'Alpha' };
      const saved = { id: 1, uuid: 'ship-uuid-1', ...dto, captainId: 1 };
      const created = { ...saved, captain: { uuid: 'captain-uuid-1' } };

      mockRepository.create.mockReturnValue(saved);
      mockRepository.save.mockResolvedValue(saved);
      mockRepository.findByUuidOrFail.mockResolvedValue(created);
      mockNotificationProducer.enqueueSpaceshipCreated.mockResolvedValue(
        undefined,
      );

      const result = await service.createSpaceship(dto, 1);

      expect(mockRepository.findByUuidOrFail).toHaveBeenCalledWith(
        'ship-uuid-1',
      );
      expect(result).toEqual(created);
    });

    it('invalidates the spaceship list cache after saving', async () => {
      const dto = { name: 'Falcon', fleet: 'Alpha' };
      const saved = { id: 1, uuid: 'ship-uuid-1', ...dto, captainId: 1 };

      mockRepository.create.mockReturnValue(saved);
      mockRepository.save.mockResolvedValue(saved);
      mockRepository.findByUuidOrFail.mockResolvedValue(saved);
      mockNotificationProducer.enqueueSpaceshipCreated.mockResolvedValue(
        undefined,
      );

      await service.createSpaceship(dto, 1);

      expect(mockCache.del).toHaveBeenCalledWith(SPACESHIP_LIST_CACHE_KEY);
    });

    it('does not fail creation when cache invalidation fails', async () => {
      const dto = { name: 'Falcon', fleet: 'Alpha' };
      const saved = { id: 1, uuid: 'ship-uuid-1', ...dto, captainId: 1 };

      mockRepository.create.mockReturnValue(saved);
      mockRepository.save.mockResolvedValue(saved);
      mockRepository.findByUuidOrFail.mockResolvedValue(saved);
      mockNotificationProducer.enqueueSpaceshipCreated.mockResolvedValue(
        undefined,
      );
      mockCache.del.mockRejectedValue(new Error('Redis down'));

      const result = await service.createSpaceship(dto, 1);

      expect(result).toEqual(saved);
      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'Failed to invalidate spaceship list cache',
        error: expect.any(Error),
      });
    });

    it('enqueues the spaceship-created notification with the minimal payload', async () => {
      const dto = { name: 'Falcon', fleet: 'Alpha' };
      const saved = { id: 1, uuid: 'ship-uuid-1', ...dto, captainId: 1 };

      mockRepository.create.mockReturnValue(saved);
      mockRepository.save.mockResolvedValue(saved);
      mockRepository.findByUuidOrFail.mockResolvedValue(saved);
      mockNotificationProducer.enqueueSpaceshipCreated.mockResolvedValue(
        undefined,
      );

      await service.createSpaceship(dto, 1);

      expect(
        mockNotificationProducer.enqueueSpaceshipCreated,
      ).toHaveBeenCalledWith({
        spaceshipUuid: 'ship-uuid-1',
        name: 'Falcon',
        fleet: 'Alpha',
      });
    });

    it('returns the created spaceship and logs the error when enqueueing fails', async () => {
      const dto = { name: 'Falcon', fleet: 'Alpha' };
      const saved = { id: 1, uuid: 'ship-uuid-1', ...dto, captainId: 1 };
      const enqueueError = new Error('Redis down');

      mockRepository.create.mockReturnValue(saved);
      mockRepository.save.mockResolvedValue(saved);
      mockRepository.findByUuidOrFail.mockResolvedValue(saved);
      mockNotificationProducer.enqueueSpaceshipCreated.mockRejectedValue(
        enqueueError,
      );

      const result = await service.createSpaceship(dto, 1);

      expect(result).toEqual(saved);
      expect(mockLogger.error).toHaveBeenCalledWith({
        message: 'Failed to enqueue spaceship-created notification',
        data: { spaceshipUuid: 'ship-uuid-1' },
        error: enqueueError,
      });
    });
  });

  describe('getAllSpaceships', () => {
    it('returns the cached list without querying the database on a cache hit', async () => {
      // The fixture carries dates because a real cached row always does: it
      // was written from an entity. A date-free fixture would let a cache hit
      // return ISO strings under a `Date` type and no test would notice.
      const ships = [
        {
          id: 'ship-1',
          name: 'Falcon',
          fleet: 'Alpha',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          deletedAt: null,
        },
      ];
      mockCache.get.mockResolvedValue(JSON.stringify(ships));

      const result = await service.getAllSpaceships();

      expect(mockCache.get).toHaveBeenCalledWith(SPACESHIP_LIST_CACHE_KEY);
      expect(mockRepository.findAll).not.toHaveBeenCalled();
      expect(result).toEqual(ships);
      expect(result?.[0].createdAt).toBeInstanceOf(Date);
      expect(result?.[0].updatedAt).toBeInstanceOf(Date);
      expect(result?.[0].deletedAt).toBeNull();
    });

    it('revives the deletion timestamp when a soft-deleted row was cached', async () => {
      const deletedAt = new Date('2026-01-03T00:00:00.000Z');
      mockCache.get.mockResolvedValue(
        JSON.stringify([
          {
            id: 'ship-1',
            name: 'Falcon',
            fleet: 'Alpha',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
            deletedAt,
          },
        ]),
      );

      const result = await service.getAllSpaceships();

      expect(result?.[0].deletedAt).toEqual(deletedAt);
    });

    it('queries the database and populates the cache on a cache miss', async () => {
      const ships = [{ id: 'ship-1', name: 'Falcon', fleet: 'Alpha' }];
      mockCache.get.mockResolvedValue(null);
      mockRepository.findAll.mockResolvedValue(ships);

      const result = await service.getAllSpaceships();

      expect(mockRepository.findAll).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith(
        SPACESHIP_LIST_CACHE_KEY,
        JSON.stringify(ships),
        mockCacheConfig.listTtlSeconds,
      );
      expect(result).toEqual(ships);
    });

    it('falls back to the database when reading from cache fails', async () => {
      const ships = [{ id: 'ship-1', name: 'Falcon', fleet: 'Alpha' }];
      mockCache.get.mockRejectedValue(new Error('Redis down'));
      mockRepository.findAll.mockResolvedValue(ships);

      const result = await service.getAllSpaceships();

      expect(mockRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual(ships);
      expect(mockLogger.warn).toHaveBeenCalledWith({
        message:
          'Failed to read spaceship list from cache, falling back to database',
        error: expect.any(Error),
      });
    });

    it('still returns the database result when writing to cache fails', async () => {
      const ships = [{ id: 'ship-1', name: 'Falcon', fleet: 'Alpha' }];
      mockCache.get.mockResolvedValue(null);
      mockRepository.findAll.mockResolvedValue(ships);
      mockCache.set.mockRejectedValue(new Error('Redis down'));

      const result = await service.getAllSpaceships();

      expect(result).toEqual(ships);
      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'Failed to write spaceship list to cache',
        error: expect.any(Error),
      });
    });
  });

  describe('getSpaceshipById', () => {
    it('returns the spaceship when found', async () => {
      const ship = {
        id: 1,
        uuid: 'ship-uuid-1',
        name: 'Falcon',
        fleet: 'Alpha',
      };
      mockRepository.findByUuidOrFail.mockResolvedValue(ship);

      const result = await service.getSpaceshipById('ship-uuid-1');

      expect(mockRepository.findByUuidOrFail).toHaveBeenCalledWith(
        'ship-uuid-1',
      );
      expect(result).toEqual(ship);
    });

    it('propagates the not-found error from the repository', async () => {
      const error = new Error('not found');
      mockRepository.findByUuidOrFail.mockRejectedValue(error);

      await expect(service.getSpaceshipById('unknown')).rejects.toThrow(error);
    });
  });

  describe('updateSpaceship', () => {
    it('updates and returns the updated spaceship', async () => {
      const dto = { name: 'Millennium Falcon' } as UpdateSpaceshipDto;
      const updated = {
        id: 1,
        uuid: 'ship-uuid-1',
        name: 'Millennium Falcon',
        fleet: 'Alpha',
      };

      mockRepository.update.mockResolvedValue(undefined);
      mockRepository.findByUuidOrFail.mockResolvedValue(updated);

      const result = await service.updateSpaceship('ship-uuid-1', dto);

      expect(mockRepository.update).toHaveBeenCalledWith('ship-uuid-1', dto);
      expect(mockRepository.findByUuidOrFail).toHaveBeenCalledWith(
        'ship-uuid-1',
      );
      expect(result).toEqual(updated);
    });

    it('invalidates the spaceship list cache after updating', async () => {
      const dto = { name: 'Millennium Falcon' } as UpdateSpaceshipDto;
      const updated = { id: 1, uuid: 'ship-uuid-1', ...dto };

      mockRepository.update.mockResolvedValue(undefined);
      mockRepository.findByUuidOrFail.mockResolvedValue(updated);

      await service.updateSpaceship('ship-uuid-1', dto);

      expect(mockCache.del).toHaveBeenCalledWith(SPACESHIP_LIST_CACHE_KEY);
    });
  });

  describe('deleteSpaceship', () => {
    it('soft-deletes the spaceship and returns it with deletedAt set', async () => {
      const ship = {
        id: 1,
        uuid: 'ship-uuid-1',
        name: 'Falcon',
        fleet: 'Alpha',
        captainId: 1,
      };
      const softDeleted = { ...ship, deletedAt: new Date() };

      mockRepository.findByUuidOrFail.mockResolvedValue(ship);
      mockRepository.softRemove.mockResolvedValue(softDeleted);

      const result = await service.deleteSpaceship('ship-uuid-1');

      expect(mockRepository.findByUuidOrFail).toHaveBeenCalledWith(
        'ship-uuid-1',
      );
      expect(mockRepository.softRemove).toHaveBeenCalledWith(ship);
      expect(result.uuid).toBe('ship-uuid-1');
      expect(result.deletedAt).toBeInstanceOf(Date);
    });

    it('invalidates the spaceship list cache after deleting', async () => {
      const ship = { id: 1, uuid: 'ship-uuid-1', name: 'Falcon' };
      const softDeleted = { ...ship, deletedAt: new Date() };

      mockRepository.findByUuidOrFail.mockResolvedValue(ship);
      mockRepository.softRemove.mockResolvedValue(softDeleted);

      await service.deleteSpaceship('ship-uuid-1');

      expect(mockCache.del).toHaveBeenCalledWith(SPACESHIP_LIST_CACHE_KEY);
    });
  });
});
