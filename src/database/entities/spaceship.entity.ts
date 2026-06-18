import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { User } from './user.entity';
import { BaseEntity } from './base.entity';

@Entity()
export class Spaceship extends BaseEntity {
  @Column()
  name: string;

  @Column()
  fleet: string;

  @OneToOne(() => User, (user) => user.ship)
  @JoinColumn({ name: 'captainId' })
  captain: User;

  // Explicit FK column so captainId is readable without loading the relation.
  @Column({ name: 'captainId', unique: true })
  captainId: number;
}
