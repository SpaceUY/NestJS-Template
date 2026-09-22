import { Inject, Injectable } from '@nestjs/common';
import { Spaceship } from '../database/entities/spaceship.entity';
import { CreateSpaceshipDto } from './dto/create-spaceship.dto';
import { UpdateSpaceshipDto } from './dto/update-spaceship.dto';
import { SpaceshipRepository } from './spaceship.repository';
import { SpaceshipNotificationProducer } from './notification/notification.producer';
import { LoggerService } from '../common/observability/logger/abstract/logger.service';
import { CacheService } from '../cache/abstract/cache.service';
import {
  spaceshipCacheScope,
  SpaceshipCacheScopeConfig,
} from './config/spaceship-cache.scope';
import { SPACESHIP_LIST_CACHE_KEY } from './spaceship.constants';

// What a `Spaceship` actually looks like after a JSON round trip through the
// cache: every `Date` is an ISO string.
type SerializedSpaceship = Omit<
  Spaceship,
  'createdAt' | 'updatedAt' | 'deletedAt'
> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/**
 * Turns a cached row back into the shape the database path returns.
 *
 * @param {SerializedSpaceship} raw - One entry as `JSON.parse` produced it.
 * @returns {Spaceship} The same row with its date fields as `Date` objects.
 */
function reviveSpaceship(raw: SerializedSpaceship): Spaceship {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
    // Null for every row the list endpoint returns; a value only if a
    // soft-deleted row was ever cached.
    deletedAt: raw.deletedAt ? new Date(raw.deletedAt) : null,
  };
}

@Injectable()
export class SpaceshipService {
  constructor(
    private readonly spaceshipRepository: SpaceshipRepository,
    private readonly notificationProducer: SpaceshipNotificationProducer,
    private readonly logger: LoggerService,
    private readonly cache: CacheService,
    @Inject(spaceshipCacheScope.KEY)
    private readonly cacheConfig: SpaceshipCacheScopeConfig,
  ) {
    this.logger.setContext(SpaceshipService.name);
  }

  async createSpaceship(
    data: CreateSpaceshipDto,
    userId: number,
  ): Promise<Spaceship> {
    const spaceship = this.spaceshipRepository.create({
      ...data,
      captainId: userId,
    });
    const saved = await this.spaceshipRepository.save(spaceship);
    // Re-fetch with the captain relation loaded — save() only returns what
    // it was given (captainId, no captain), and the response DTO needs
    // captain.uuid.
    const created = await this.spaceshipRepository.findByUuidOrFail(saved.uuid);
    await this.invalidateSpaceshipListCache();

    try {
      await this.notificationProducer.enqueueSpaceshipCreated({
        spaceshipUuid: created.uuid,
        name: created.name,
        fleet: created.fleet,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to enqueue spaceship-created notification',
        data: { spaceshipUuid: created.uuid },
        error,
      });
    }

    return created;
  }

  async getAllSpaceships(): Promise<Spaceship[]> {
    const cached = await this.readSpaceshipListFromCache();
    if (cached) return cached;

    const spaceships = await this.spaceshipRepository.findAll();
    await this.writeSpaceshipListToCache(spaceships);
    return spaceships;
  }

  async getSpaceshipById(uuid: string): Promise<Spaceship> {
    return this.spaceshipRepository.findByUuidOrFail(uuid);
  }

  async updateSpaceship(
    uuid: string,
    data: UpdateSpaceshipDto,
  ): Promise<Spaceship> {
    await this.spaceshipRepository.update(uuid, data);
    const updated = await this.spaceshipRepository.findByUuidOrFail(uuid);
    await this.invalidateSpaceshipListCache();
    return updated;
  }

  async deleteSpaceship(uuid: string): Promise<Spaceship> {
    const spaceship = await this.spaceshipRepository.findByUuidOrFail(uuid);
    const deleted = await this.spaceshipRepository.softRemove(spaceship);
    await this.invalidateSpaceshipListCache();
    return deleted;
  }

  private async readSpaceshipListFromCache(): Promise<Spaceship[] | null> {
    try {
      const raw = await this.cache.get(SPACESHIP_LIST_CACHE_KEY);
      if (!raw) return null;

      // JSON has no date type, so `createdAt`/`updatedAt` come back as ISO
      // strings. Casting alone would leave the declared `Date` type lying
      // about what the object holds — the HTTP response happens to serialize
      // the same either way, but the first caller to reach for `.getTime()`
      // on a cached row gets a TypeError. Revive them here, where the shape
      // is known, rather than leaving the trap for the caller.
      return (JSON.parse(raw) as SerializedSpaceship[]).map(reviveSpaceship);
    } catch (error) {
      this.logger.warn({
        message:
          'Failed to read spaceship list from cache, falling back to database',
        error,
      });
      return null;
    }
  }

  private async writeSpaceshipListToCache(
    spaceships: Spaceship[],
  ): Promise<void> {
    try {
      await this.cache.set(
        SPACESHIP_LIST_CACHE_KEY,
        JSON.stringify(spaceships),
        this.cacheConfig.listTtlSeconds,
      );
    } catch (error) {
      this.logger.warn({
        message: 'Failed to write spaceship list to cache',
        error,
      });
    }
  }

  private async invalidateSpaceshipListCache(): Promise<void> {
    try {
      await this.cache.del(SPACESHIP_LIST_CACHE_KEY);
    } catch (error) {
      this.logger.warn({
        message: 'Failed to invalidate spaceship list cache',
        error,
      });
    }
  }
}
