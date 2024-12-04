import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ required: true, minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;

  @ApiProperty({ required: true })
  @IsString()
  resetToken: string;
}
