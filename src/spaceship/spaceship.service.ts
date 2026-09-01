import { Injectable } from '@nestjs/common';
import { Spaceship } from '../database/entities/spaceship.entity';
import { CreateSpaceshipDto } from './dto/create-spaceship.dto';
import { UpdateSpaceshipDto } from './dto/update-spaceship.dto';
import { SpaceshipRepository } from './spaceship.repository';

@Injectable()
export class SpaceshipService {
  constructor(private readonly spaceshipRepository: SpaceshipRepository) {}

  async createSpaceship(
    data: CreateSpaceshipDto,
    userId: number,
  ): Promise<Spaceship> {
    const spaceship = this.spaceshipRepository.create({
      ...data,
      captainId: userId,
    });
    return this.spaceshipRepository.save(spaceship);
  }

  async getAllSpaceships(): Promise<Spaceship[]> {
    return this.spaceshipRepository.findAll();
  }

  async getSpaceshipById(uuid: string): Promise<Spaceship> {
    return this.spaceshipRepository.findByUuidOrFail(uuid);
  }

  async updateSpaceship(
    uuid: string,
    data: UpdateSpaceshipDto,
  ): Promise<Spaceship> {
    await this.spaceshipRepository.update(uuid, data);
    return this.spaceshipRepository.findByUuidOrFail(uuid);
  }

  async deleteSpaceship(uuid: string): Promise<Spaceship> {
    const spaceship = await this.spaceshipRepository.findByUuidOrFail(uuid);
    return this.spaceshipRepository.softRemove(spaceship);
  }
}
