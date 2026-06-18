import { Column, Entity, OneToOne } from 'typeorm';
import { AuthType } from '../../auth/core/auth-type.enum';
import { Spaceship } from './spaceship.entity';
import { BaseEntity } from './base.entity';

@Entity()
export class User extends BaseEntity {
  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ default: false })
  verified: boolean;

  @Column({ type: 'enum', enum: AuthType, default: AuthType.EMAIL })
  authType: AuthType;

  @Column({ type: 'varchar', unique: true, nullable: true })
  auth0Id: string | null;

  @OneToOne(() => Spaceship, (spaceship) => spaceship.captain)
  ship: Spaceship;
}
