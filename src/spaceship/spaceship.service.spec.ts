import { Test, TestingModule } from '@nestjs/testing';
import { SpaceshipService } from './spaceship.service';
import { SpaceshipRepository } from './spaceship.repository';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpaceshipService,
        { provide: SpaceshipRepository, useValue: mockRepository },
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
      const saved = { id: 'ship-1', ...entity };

      mockRepository.create.mockReturnValue(entity);
      mockRepository.save.mockResolvedValue(saved);

      const result = await service.createSpaceship(dto, userId);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...dto,
        captainId: userId,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(entity);
      expect(result).toEqual(saved);
    });
  });

  describe('getAllSpaceships', () => {
    it('returns all spaceships', async () => {
      const ships = [{ id: 'ship-1', name: 'Falcon', fleet: 'Alpha' }];
      mockRepository.findAll.mockResolvedValue(ships);

      const result = await service.getAllSpaceships();

      expect(mockRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual(ships);
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
  });
});
