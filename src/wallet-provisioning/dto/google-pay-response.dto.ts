import { ApiProperty } from '@nestjs/swagger';

// The processor's opaque payment cards, returned unchanged.
export class GooglePayResponseDto {
  @ApiProperty()
  opc!: string;

  @ApiProperty()
  googleOpc!: string;
}
