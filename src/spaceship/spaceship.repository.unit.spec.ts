import { QueryFailedError, Repository } from 'typeorm';
import { RequestException } from '../common/exception/core/ExceptionBase';
import { Spaceship } from '../database/entities/spaceship.entity';
import { SpaceshipRepository } from './spaceship.repository';

describe('SpaceshipRepository', () => {
  let repository: SpaceshipRepository;
  let typeormRepository: jest.Mocked<Pick<Repository<Spaceship>, 'save'>>;

  beforeEach(() => {
    typeormRepository = { save: jest.fn() };
    repository = new SpaceshipRepository(
      typeormRepository as unknown as Repository<Spaceship>,
    );
  });

  describe('save', () => {
    it('returns the saved spaceship on success', async () => {
      const spaceship = { captainId: 1 } as Spaceship;
      typeormRepository.save.mockResolvedValue(spaceship);

      const result = await repository.save(spaceship);

      expect(result).toBe(spaceship);
    });

    it('translates a unique constraint violation on captainId into a conflict exception', async () => {
      const spaceship = { captainId: 1 } as Spaceship;
      const violation = Object.assign(
        new QueryFailedError('INSERT', [], new Error('duplicate key')),
        { code: '23505' },
      );
      typeormRepository.save.mockRejectedValue(violation);

      let error: unknown;
      try {
        await repository.save(spaceship);
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).toBeInstanceOf(RequestException);
      expect((error as RequestException).errorCode).toBe('DB_EXISTING');
      expect((error as RequestException).message).toContain('captainId');
    });

    it('rethrows unrelated database errors unchanged', async () => {
      const spaceship = { captainId: 1 } as Spaceship;
      const otherError = Object.assign(
        new QueryFailedError('INSERT', [], new Error('connection lost')),
        { code: '08006' },
      );
      typeormRepository.save.mockRejectedValue(otherError);

      await expect(repository.save(spaceship)).rejects.toBe(otherError);
    });
  });
});
