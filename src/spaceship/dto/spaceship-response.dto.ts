import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class SpaceshipResponseDto {
  @Expose()
  @ApiProperty()
  uuid: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty()
  fleet: string;

  @Expose()
  @ApiProperty()
  captainId: number;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}
