import { Column, Entity } from 'typeorm';
import { AuthType } from './auth-type.enum';
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
}
