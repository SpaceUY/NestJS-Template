import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

// Google Wallet's server session id, from TapAndPay's PaymentCredentialsGenerator. Never logged.
export class GooglePayRequestDto {
  @ApiPropertyOptional({
    description: "The card's uuid. Omit when users have a single card.",
  })
  @IsOptional()
  @IsUUID()
  cardId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  serverSessionId!: string;
}
