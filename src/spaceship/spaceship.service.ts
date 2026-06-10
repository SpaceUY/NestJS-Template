import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Spaceship } from './spaceship.entity';
import { CreateSpaceshipDto } from './dto/create-spaceship.dto';
import { UpdateSpaceshipDto } from './dto/update-spaceship.dto';

@Injectable()
export class SpaceshipService {
  constructor(
    @InjectRepository(Spaceship)
    private readonly spaceshipRepository: Repository<Spaceship>,
  ) {}

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
    return this.spaceshipRepository.find();
  }

  async getSpaceshipById(id: string): Promise<Spaceship | null> {
    return this.spaceshipRepository.findOne({ where: { id } });
  }

  async updateSpaceship(
    id: string,
    data: UpdateSpaceshipDto,
  ): Promise<Spaceship> {
    await this.spaceshipRepository.update(id, data);
    return this.spaceshipRepository.findOneOrFail({ where: { id } });
  }

  async deleteSpaceship(id: string): Promise<Spaceship> {
    const spaceship = await this.spaceshipRepository.findOneOrFail({
      where: { id },
    });
    return this.spaceshipRepository.softRemove(spaceship);
  }
}
