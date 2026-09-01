import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestException } from '../common/exception/core/ExceptionBase';
import { Exceptions } from '../common/exception/exceptions';
import { Spaceship } from '../database/entities/spaceship.entity';

@Injectable()
export class SpaceshipRepository {
  constructor(
    @InjectRepository(Spaceship)
    private readonly repository: Repository<Spaceship>,
  ) {}

  create(data: Partial<Spaceship>): Spaceship {
    return this.repository.create(data);
  }

  save(spaceship: Spaceship): Promise<Spaceship> {
    return this.repository.save(spaceship);
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
