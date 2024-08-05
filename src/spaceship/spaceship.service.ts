import { Injectable } from '@nestjs/common';
import { Spaceship } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpaceshipDto } from './dto/create-spaceship.dto';
import { UpdateSpaceshipDto } from './dto/update-spaceship.dto';

@Injectable()
export class SpaceshipService {
  constructor(private readonly prisma: PrismaService) {}

  async createSpaceship(
    data: CreateSpaceshipDto,
    userId: string,
  ): Promise<Spaceship> {
    return this.prisma.spaceship.create({
      data: { ...data, captainId: userId },
    });
  }

  async getAllSpaceships(): Promise<Spaceship[]> {
    return this.prisma.spaceship.findMany();
  }

  async getSpaceshipById(id: string): Promise<Spaceship | null> {
    return this.prisma.spaceship.findUnique({ where: { id } });
  }

  async updateSpaceship(
    id: string,
    data: UpdateSpaceshipDto,
  ): Promise<Spaceship> {
    return this.prisma.spaceship.update({
      where: { id },
      data,
    });
  }

  async deleteSpaceship(id: string): Promise<Spaceship> {
    return this.prisma.spaceship.delete({ where: { id } });
  }
}
