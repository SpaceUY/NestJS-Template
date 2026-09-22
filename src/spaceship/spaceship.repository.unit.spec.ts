import { QueryFailedError, Repository } from 'typeorm';
import { RequestException } from '../common/exception/core/ExceptionBase';
import { Spaceship } from '../database/entities/spaceship.entity';
import { SpaceshipRepository } from './spaceship.repository';

type MockedMethods = Pick<
  Repository<Spaceship>,
  'create' | 'save' | 'find' | 'findOne' | 'update' | 'softRemove'
>;

describe('SpaceshipRepository', () => {
  let repository: SpaceshipRepository;
  let typeormRepository: jest.Mocked<MockedMethods>;

  beforeEach(() => {
    typeormRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      softRemove: jest.fn(),
    } as unknown as jest.Mocked<MockedMethods>;
    repository = new SpaceshipRepository(
      typeormRepository as unknown as Repository<Spaceship>,
    );
  });

  describe('create', () => {
    it('delegates to TypeORM without touching the database', () => {
      const spaceship = { name: 'Falcon' } as Spaceship;
      typeormRepository.create.mockReturnValue(spaceship);

      expect(repository.create({ name: 'Falcon' })).toBe(spaceship);
      expect(typeormRepository.save).not.toHaveBeenCalled();
    });
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

  // The `select` these two share is what keeps the captain's email and the
  // rest of the User row out of a response — and out of the cache entry the
  // service writes from it. A widened select would leak PII silently, so it
  // is asserted rather than assumed.
  describe('reads', () => {
    it('loads the captain relation but only its public uuid', async () => {
      typeormRepository.find.mockResolvedValue([]);

      await repository.findAll();

      const [options] = typeormRepository.find.mock.calls[0];
      expect(options?.relations).toEqual({ captain: true });
      expect(options?.select).toEqual(
        expect.objectContaining({ captain: { uuid: true } }),
      );
      expect(options?.select).not.toHaveProperty('captain.email');
    });

    it('looks a spaceship up by uuid, never by the internal id', async () => {
      const spaceship = { uuid: 'ship-uuid-1' } as Spaceship;
      typeormRepository.findOne.mockResolvedValue(spaceship);

      const result = await repository.findByUuid('ship-uuid-1');

      expect(result).toBe(spaceship);
      const [options] = typeormRepository.findOne.mock.calls[0];
      expect(options?.where).toEqual({ uuid: 'ship-uuid-1' });
    });

    it('returns null from findByUuid when no row matches', async () => {
      typeormRepository.findOne.mockResolvedValue(null);

      await expect(repository.findByUuid('missing')).resolves.toBeNull();
    });
  });

  describe('findByUuidOrFail', () => {
    it('returns the spaceship when one matches', async () => {
      const spaceship = { uuid: 'ship-uuid-1' } as Spaceship;
      typeormRepository.findOne.mockResolvedValue(spaceship);

      await expect(repository.findByUuidOrFail('ship-uuid-1')).resolves.toBe(
        spaceship,
      );
    });

    // A missing spaceship is a 404, not a null the caller has to remember to
    // check — see this module's guide, Rule 8.
    it('throws a 404 request exception when none does', async () => {
      typeormRepository.findOne.mockResolvedValue(null);

      let error: unknown;
      try {
        await repository.findByUuidOrFail('missing-uuid');
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).toBeInstanceOf(RequestException);
      expect((error as RequestException).errorCode).toBe('SPACESHIP_NOT_FOUND');
      expect((error as RequestException).getStatus()).toBe(404);
      expect((error as RequestException).message).toContain('missing-uuid');
    });
  });

  describe('writes', () => {
    it('updates by uuid', async () => {
      typeormRepository.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });

      await repository.update('ship-uuid-1', { name: 'Falcon II' });

      expect(typeormRepository.update).toHaveBeenCalledWith(
        { uuid: 'ship-uuid-1' },
        { name: 'Falcon II' },
      );
    });

    // Soft delete, never `delete` — the row stays for auditing and the
    // `deletedAt` column is what excludes it from later reads.
    it('removes softly', async () => {
      const spaceship = { uuid: 'ship-uuid-1' } as Spaceship;
      typeormRepository.softRemove.mockResolvedValue(spaceship);

      await expect(repository.softRemove(spaceship)).resolves.toBe(spaceship);
      expect(typeormRepository.softRemove).toHaveBeenCalledWith(spaceship);
    });
  });
});
