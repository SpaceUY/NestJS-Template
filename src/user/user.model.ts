import { AuthType } from 'src/auth/auth-types.enum';
import { BaseModel } from 'src/common/base.model';
import { Column, Entity } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class User extends BaseModel {
  @Column()
  @ApiProperty()
  name: string;

  @Column()
  @ApiProperty()
  email: string;

  @Column({ default: false })
  @ApiProperty()
  verified: boolean;

  @Column({
    type: 'enum',
    enum: AuthType,
    default: AuthType.EMAIL,
  })
  @ApiProperty({ enum: AuthType })
  authType: AuthType;
}
