import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Generated,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthType } from '../auth/core/auth-type.enum';
import { Spaceship } from '../spaceship/spaceship.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  @Generated('uuid')
  uuid: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ default: false })
  verified: boolean;

  @Column({ type: 'enum', enum: AuthType, default: AuthType.EMAIL })
  authType: AuthType;

  @OneToOne(() => Spaceship, (spaceship) => spaceship.captain)
  ship: Spaceship;
}
