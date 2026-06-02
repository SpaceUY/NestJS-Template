import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity()
export class Spaceship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @Column()
  name: string;

  @Column()
  fleet: string;

  @OneToOne(() => User, (user) => user.ship)
  @JoinColumn({ name: 'captainId' })
  captain: User;

  @Column({ name: 'captainId', unique: true })
  captainId: string;
}
