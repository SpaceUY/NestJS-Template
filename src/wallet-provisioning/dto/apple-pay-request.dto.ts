import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBase64,
  IsOptional,
  IsUUID,
} from 'class-validator';

// What Apple's PassKit hands the app when the user taps "Add to Apple Wallet". Never logged.
export class ApplePayRequestDto {
  @ApiPropertyOptional({
    description: "The card's uuid. Omit when users have a single card.",
  })
  @IsOptional()
  @IsUUID()
  cardId?: string;

  @ApiProperty({ type: [String], description: 'Base64 certificate chain' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  @IsBase64({}, { each: true })
  certificates!: string[];

  @ApiProperty({ description: 'Base64' })
  @IsBase64()
  nonce!: string;

  @ApiProperty({ description: 'Base64' })
  @IsBase64()
  nonceSignature!: string;
}
