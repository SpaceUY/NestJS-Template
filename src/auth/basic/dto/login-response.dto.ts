import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginResponseDto {
  @ApiProperty({ description: 'Authentication token', required: true })
  @IsString()
  readonly token: string;

  @ApiProperty({ description: 'Authentication refresh token', required: true })
  @IsString()
  readonly refreshToken: string;
}
