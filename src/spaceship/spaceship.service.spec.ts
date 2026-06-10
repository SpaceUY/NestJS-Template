import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SpaceshipService } from './spaceship.service';
import { Spaceship } from './spaceship.entity';
import { UpdateSpaceshipDto } from './dto/update-spaceship.dto';

describe('SpaceshipService', () => {
  let service: SpaceshipService;

  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    update: jest.fn(),
    softRemove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpaceshipService,
        { provide: getRepositoryToken(Spaceship), useValue: mockRepo },
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

      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(saved);

      const result = await service.createSpaceship(dto, userId);

      expect(mockRepo.create).toHaveBeenCalledWith({ ...dto, captainId: userId });
      expect(mockRepo.save).toHaveBeenCalledWith(entity);
      expect(result).toEqual(saved);
    });
  });

  describe('getAllSpaceships', () => {
    it('returns all spaceships', async () => {
      const ships = [{ id: 'ship-1', name: 'Falcon', fleet: 'Alpha' }];
      mockRepo.find.mockResolvedValue(ships);

      const result = await service.getAllSpaceships();

      expect(mockRepo.find).toHaveBeenCalled();
      expect(result).toEqual(ships);
    });
  });

  describe('getSpaceshipById', () => {
    it('returns the spaceship when found', async () => {
      const ship = { id: 'ship-1', name: 'Falcon', fleet: 'Alpha' };
      mockRepo.findOne.mockResolvedValue(ship);

      const result = await service.getSpaceshipById('ship-1');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'ship-1' } });
      expect(result).toEqual(ship);
    });

    it('returns null when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.getSpaceshipById('unknown');

      expect(result).toBeNull();
    });
  });

  describe('updateSpaceship', () => {
    it('updates and returns the updated spaceship', async () => {
      const dto = { name: 'Millennium Falcon' } as UpdateSpaceshipDto;
      const updated = { id: 'ship-1', name: 'Millennium Falcon', fleet: 'Alpha' };

      mockRepo.update.mockResolvedValue({ affected: 1 });
      mockRepo.findOneOrFail.mockResolvedValue(updated);

      const result = await service.updateSpaceship('ship-1', dto);

      expect(mockRepo.update).toHaveBeenCalledWith('ship-1', dto);
      expect(mockRepo.findOneOrFail).toHaveBeenCalledWith({ where: { id: 'ship-1' } });
      expect(result).toEqual(updated);
    });
  });

  describe('deleteSpaceship', () => {
    it('soft-deletes the spaceship and returns it with deletedAt set', async () => {
      const ship = { id: 'ship-1', name: 'Falcon', fleet: 'Alpha', captainId: 1 };
      const softDeleted = { ...ship, deletedAt: new Date() };

      mockRepo.findOneOrFail.mockResolvedValue(ship);
      mockRepo.softRemove.mockResolvedValue(softDeleted);

      const result = await service.deleteSpaceship('ship-1');

      expect(mockRepo.findOneOrFail).toHaveBeenCalledWith({ where: { id: 'ship-1' } });
      expect(mockRepo.softRemove).toHaveBeenCalledWith(ship);
      expect(result.id).toBe('ship-1');
      expect(result.deletedAt).toBeInstanceOf(Date);
    });
  });
});
