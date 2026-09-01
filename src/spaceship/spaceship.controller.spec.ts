import { Test, TestingModule } from '@nestjs/testing';
import { SpaceshipController } from './spaceship.controller';
import { SpaceshipService } from './spaceship.service';
import { User } from '../database/entities/user.entity';
import { UpdateSpaceshipDto } from './dto/update-spaceship.dto';

describe('SpaceshipController', () => {
  let controller: SpaceshipController;

  const mockService = {
    createSpaceship: jest.fn(),
    getAllSpaceships: jest.fn(),
    getSpaceshipById: jest.fn(),
    updateSpaceship: jest.fn(),
    deleteSpaceship: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpaceshipController],
      providers: [{ provide: SpaceshipService, useValue: mockService }],
    }).compile();

    controller = module.get<SpaceshipController>(SpaceshipController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    id: 1,
    name: 'Captain',
    email: 'captain@space.com',
  } as unknown as User;

  describe('createSpaceship', () => {
    it('delegates to service with the current user id and maps the response', async () => {
      const dto = { name: 'Falcon', fleet: 'Alpha' };
      const entity = { uuid: 'ship-1', ...dto, captainId: 1 };
      mockService.createSpaceship.mockResolvedValue(entity);

      const result = await controller.createSpaceship(dto, mockUser);

      expect(mockService.createSpaceship).toHaveBeenCalledWith(dto, 1);
      expect(result).toMatchObject({
        uuid: 'ship-1',
        name: 'Falcon',
        fleet: 'Alpha',
        captainId: 1,
      });
    });
  });

  describe('getAllSpaceships', () => {
    it('returns all spaceships mapped from service', async () => {
      const ships = [{ uuid: 'ship-1', name: 'Falcon', fleet: 'Alpha' }];
      mockService.getAllSpaceships.mockResolvedValue(ships);

      const result = await controller.getAllSpaceships();

      expect(mockService.getAllSpaceships).toHaveBeenCalled();
      expect(result).toMatchObject(ships);
    });
  });

  describe('getSpaceshipById', () => {
    it('delegates to service with the route id and maps the response', async () => {
      const ship = { uuid: 'ship-1', name: 'Falcon', fleet: 'Alpha' };
      mockService.getSpaceshipById.mockResolvedValue(ship);

      const result = await controller.getSpaceshipById('ship-1');

      expect(mockService.getSpaceshipById).toHaveBeenCalledWith('ship-1');
      expect(result).toMatchObject(ship);
    });

    it('returns null when the service finds nothing', async () => {
      mockService.getSpaceshipById.mockResolvedValue(null);

      const result = await controller.getSpaceshipById('unknown');

      expect(result).toBeNull();
    });
  });

  describe('updateSpaceship', () => {
    it('delegates to service with id and dto and maps the response', async () => {
      const dto = { name: 'Millennium Falcon' } as UpdateSpaceshipDto;
      const updated = {
        uuid: 'ship-1',
        name: 'Millennium Falcon',
        fleet: 'Alpha',
      };
      mockService.updateSpaceship.mockResolvedValue(updated);

      const result = await controller.updateSpaceship('ship-1', dto);

      expect(mockService.updateSpaceship).toHaveBeenCalledWith('ship-1', dto);
      expect(result).toMatchObject(updated);
    });
  });

  describe('deleteSpaceship', () => {
    it('delegates to service with id and maps the deleted resource', async () => {
      const deleted = { uuid: 'ship-1', name: 'Falcon', fleet: 'Alpha' };
      mockService.deleteSpaceship.mockResolvedValue(deleted);

      const result = await controller.deleteSpaceship('ship-1');

      expect(mockService.deleteSpaceship).toHaveBeenCalledWith('ship-1');
      expect(result).toMatchObject(deleted);
    });
  });
});
