import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class Auth0LoginDto {
  @ApiProperty({ description: 'Access token issued by Auth0 to the client' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
