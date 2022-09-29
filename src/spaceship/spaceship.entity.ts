import { BaseModel } from 'src/common/base.model';
import { User } from 'src/user/user.model';
import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';

@Entity()
export class Spaceship extends BaseModel {
  @Column()
  name: string;

  @Column()
  fleet: string;

  @OneToOne(() => User)
  @JoinColumn()
  captain: User;
}
