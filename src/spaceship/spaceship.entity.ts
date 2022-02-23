import { BaseModel } from 'src/common/base.model';
import { User } from 'src/user/user.model';
import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class Spaceship extends BaseModel {
  @Column()
  @ApiProperty()
  name: string;

  @Column()
  @ApiProperty()
  fleet: string;

  @OneToOne(() => User)
  @JoinColumn()
  @ApiProperty({ type: User })
  captain: User;
}
