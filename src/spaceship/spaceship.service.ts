import { Injectable } from '@nestjs/common';
import { Spaceship } from '../database/entities/spaceship.entity';
import { CreateSpaceshipDto } from './dto/create-spaceship.dto';
import { UpdateSpaceshipDto } from './dto/update-spaceship.dto';
import { SpaceshipRepository } from './spaceship.repository';
import { SpaceshipNotificationProducer } from '../queues/notification/notification.producer';
import { LoggerService } from '../common/logger/abstract/logger.service';

@Injectable()
export class SpaceshipService {
  constructor(
    private readonly spaceshipRepository: SpaceshipRepository,
    private readonly notificationProducer: SpaceshipNotificationProducer,
    private readonly logger: LoggerService,
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
