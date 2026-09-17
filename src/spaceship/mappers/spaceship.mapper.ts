import { plainToInstance } from 'class-transformer';
import { Spaceship } from '../../database/entities/spaceship.entity';
import { SpaceshipResponseDto } from '../dto/spaceship-response.dto';

export class SpaceshipMapper {
  static toResponse(spaceship: Spaceship): SpaceshipResponseDto {
    return plainToInstance(SpaceshipResponseDto, spaceship, {
      excludeExtraneousValues: true,
    });
  }

  static toResponseList(spaceships: Spaceship[]): SpaceshipResponseDto[] {
    return spaceships.map(SpaceshipMapper.toResponse);
  }
}
