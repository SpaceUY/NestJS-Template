import { ApiProperty } from '@nestjs/swagger';

export class FileResponseDto {
  @ApiProperty({
    type: 'string',
    description: 'File url from cloud storage',
    required: true,
  })
  url: string;

  @ApiProperty({
    type: 'string',
    description: 'File key from cloud storage',
    required: true,
  })
  id: string;
}
