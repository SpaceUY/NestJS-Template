import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { RequestException } from '../common/exception/core/ExceptionBase';
import { Exceptions } from '../common/exception/exceptions';
import { Spaceship } from '../database/entities/spaceship.entity';
import { SpaceshipExceptions } from './spaceship.exceptions';

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';

// Loads only the captain's uuid (the public identifier), never the full
// User row — a Spaceship list is cached whole (spaceship.service.ts), and
// caching the captain's email/other PII alongside it would be needless.
const SELECT_WITH_CAPTAIN_UUID = {
  id: true,
  uuid: true,
  name: true,
  fleet: true,
  captainId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  captain: { uuid: true },
} as const;

@Injectable()
export class SpaceshipRepository {
  constructor(
    @InjectRepository(Spaceship)
    private readonly repository: Repository<Spaceship>,
  ) {}

  create(data: Partial<Spaceship>): Spaceship {
    return this.repository.create(data);
  }

  async save(spaceship: Spaceship): Promise<Spaceship> {
    try {
      return await this.repository.save(spaceship);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as unknown as { code?: string }).code ===
          POSTGRES_UNIQUE_VIOLATION_CODE
      ) {
        throw new RequestException(
          Exceptions.database.alreadyExists({
            entity: 'Spaceship',
            field: 'captainId',
            value: String(spaceship.captainId),
          }),
        );
      }
      throw error;
    }
  }

  findAll(): Promise<Spaceship[]> {
    return this.repository.find({
      relations: { captain: true },
      select: SELECT_WITH_CAPTAIN_UUID,
    });
  }

  findByUuid(uuid: string): Promise<Spaceship | null> {
    return this.repository.findOne({
      where: { uuid },
      relations: { captain: true },
      select: SELECT_WITH_CAPTAIN_UUID,
    });
  }

  async findByUuidOrFail(uuid: string): Promise<Spaceship> {
    const spaceship = await this.findByUuid(uuid);
    if (!spaceship) {
      throw new RequestException(SpaceshipExceptions.notFound({ uuid }));
    }
    return spaceship;
  }

  async update(uuid: string, data: Partial<Spaceship>): Promise<void> {
    await this.repository.update({ uuid }, data);
  }

  softRemove(spaceship: Spaceship): Promise<Spaceship> {
    return this.repository.softRemove(spaceship);
  }
}
