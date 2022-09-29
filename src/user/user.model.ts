import { AuthType } from 'src/auth/auth-types.enum';
import { BaseModel } from 'src/common/base.model';
import { Column, Entity, OneToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Spaceship } from 'src/spaceship/spaceship.entity';

@Entity()
export class User extends BaseModel {
  @Column()
  name: string;

  @Column()
  email: string;

  @Column({ default: false })
  verified: boolean;

  @Column({
    type: 'enum',
    enum: AuthType,
    default: AuthType.EMAIL,
  })
  @ApiProperty({ enum: AuthType })
  authType: AuthType;

  @OneToOne(() => Spaceship, (ship) => ship.captain)
  ship: Spaceship;
}
