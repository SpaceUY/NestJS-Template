import { Inject, Injectable } from '@nestjs/common';
import { Spaceship } from '../database/entities/spaceship.entity';
import { CreateSpaceshipDto } from './dto/create-spaceship.dto';
import { UpdateSpaceshipDto } from './dto/update-spaceship.dto';
import { SpaceshipRepository } from './spaceship.repository';
import { SpaceshipNotificationProducer } from '../queues/notification/notification.producer';
import { LoggerService } from '../common/logger/abstract/logger.service';
import { CacheService } from '../cache/abstract/cache.service';
import {
  spaceshipCacheScope,
  SpaceshipCacheScopeConfig,
} from './config/spaceship-cache.scope';
import { SPACESHIP_LIST_CACHE_KEY } from './spaceship.constants';

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
    await this.invalidateSpaceshipListCache();

    try {
      await this.notificationProducer.enqueueSpaceshipCreated({
        spaceshipUuid: saved.uuid,
        name: saved.name,
        fleet: saved.fleet,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to enqueue spaceship-created notification',
        data: { spaceshipUuid: saved.uuid },
        error,
      });
    }

    return saved;
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
      return raw ? (JSON.parse(raw) as Spaceship[]) : null;
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
