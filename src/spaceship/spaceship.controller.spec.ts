import { Test, TestingModule } from '@nestjs/testing';
import { SpaceshipController } from './spaceship.controller';
import { SpaceshipService } from './spaceship.service';
import { User } from '../user/user.entity';
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

  const mockUser = { id: 'user-1', name: 'Captain', email: 'captain@space.com' } as User;

  describe('createSpaceship', () => {
    it('delegates to service with the current user id', async () => {
      const dto = { name: 'Falcon', fleet: 'Alpha' };
      const expected = { id: 'ship-1', ...dto, captainId: 'user-1' };
      mockService.createSpaceship.mockResolvedValue(expected);

      const result = await controller.createSpaceship(dto, mockUser);

      expect(mockService.createSpaceship).toHaveBeenCalledWith(dto, 'user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getAllSpaceships', () => {
    it('returns all spaceships from service', async () => {
      const ships = [{ id: 'ship-1', name: 'Falcon', fleet: 'Alpha' }];
      mockService.getAllSpaceships.mockResolvedValue(ships);

      const result = await controller.getAllSpaceships();

      expect(mockService.getAllSpaceships).toHaveBeenCalled();
      expect(result).toEqual(ships);
    });
  });

  describe('getSpaceshipById', () => {
    it('delegates to service with the route id', async () => {
      const ship = { id: 'ship-1', name: 'Falcon', fleet: 'Alpha' };
      mockService.getSpaceshipById.mockResolvedValue(ship);

      const result = await controller.getSpaceshipById('ship-1');

      expect(mockService.getSpaceshipById).toHaveBeenCalledWith('ship-1');
      expect(result).toEqual(ship);
    });
  });

  describe('updateSpaceship', () => {
    it('delegates to service with id and dto', async () => {
      const dto = { name: 'Millennium Falcon' } as UpdateSpaceshipDto;
      const updated = { id: 'ship-1', name: 'Millennium Falcon', fleet: 'Alpha' };
      mockService.updateSpaceship.mockResolvedValue(updated);

      const result = await controller.updateSpaceship('ship-1', dto);

      expect(mockService.updateSpaceship).toHaveBeenCalledWith('ship-1', dto);
      expect(result).toEqual(updated);
    });
  });

  describe('deleteSpaceship', () => {
    it('delegates to service with id', async () => {
      const deleted = { id: 'ship-1', name: 'Falcon', fleet: 'Alpha' };
      mockService.deleteSpaceship.mockResolvedValue(deleted);

      const result = await controller.deleteSpaceship('ship-1');

      expect(mockService.deleteSpaceship).toHaveBeenCalledWith('ship-1');
      expect(result).toEqual(deleted);
    });
  });
});
