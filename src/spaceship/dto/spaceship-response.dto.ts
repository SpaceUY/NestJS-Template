import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class SpaceshipResponseDto {
  @Expose()
  @ApiProperty()
  uuid!: string;

  @Expose()
  @ApiProperty()
  name!: string;

  @Expose()
  @ApiProperty()
  fleet!: string;

  // The captain's public uuid, never the internal `captainId` FK — see
  // root CLAUDE.md: "uuid is the only identifier an API response may expose".
  @Expose()
  @Transform(
    ({ obj }: { obj: { captain?: { uuid: string } } }) => obj.captain?.uuid,
  )
  @ApiProperty()
  captainUuid!: string;

  @Expose()
  @ApiProperty()
  createdAt!: Date;

  @Expose()
  @ApiProperty()
  updatedAt!: Date;
}
