import { ApiProperty } from '@nestjs/swagger';

export class ApplePayResponseDto {
  @ApiProperty({ description: 'Base64' })
  activationData!: string;

  @ApiProperty({ description: 'Base64' })
  encryptedPassData!: string;

  @ApiProperty({ description: 'Base64' })
  ephemeralPublicKey!: string;
}
