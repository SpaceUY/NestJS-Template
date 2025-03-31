import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ description: 'Email', required: true })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password', required: true, minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
