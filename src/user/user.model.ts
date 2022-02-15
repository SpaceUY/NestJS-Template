import { AuthType } from 'src/auth/auth-types.enum';
import { BaseModel } from 'src/common/base.model';
import { Column, Entity } from 'typeorm';

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
  authType: AuthType;
}
