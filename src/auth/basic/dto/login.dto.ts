import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Email', required: true })
  @IsString()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password', required: true, minLength: 8 })
  @MinLength(8)
  @IsString()
  password: string;
}
