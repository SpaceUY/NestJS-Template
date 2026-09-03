import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { RequestException } from '../common/exception/core/ExceptionBase';
import { Exceptions } from '../common/exception/exceptions';
import { Spaceship } from '../database/entities/spaceship.entity';

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';

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
    return this.repository.find();
  }

  findByUuid(uuid: string): Promise<Spaceship | null> {
    return this.repository.findOne({ where: { uuid } });
  }

  async findByUuidOrFail(uuid: string): Promise<Spaceship> {
    const spaceship = await this.findByUuid(uuid);
    if (!spaceship) {
      throw new RequestException(Exceptions.spaceship.notFound({ uuid }));
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
