import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, Length, IsObject, IsUrl } from 'class-validator';

export class PushNotificationDto {
  @ApiProperty({
    description: 'Notification Title',
    example: 'Notification',
  })
  @IsString()
  @Length(2, 50)
  readonly title: string;

  @ApiProperty({
    description: 'Notification Content',
    example: 'New notification',
  })
  @IsString()
  @Length(2, 250)
  readonly body: string;

  @ApiProperty({
    description:
      'Data object such as IDs or relevant information needed to be retrieved in the frontend',
  })
  @IsObject()
  @IsOptional()
  readonly data: Record<string, string>;

  @IsOptional()
  @IsUrl()
  @ApiProperty({
    description: 'Deep Link to redirect',
  })
  readonly deepLink: string;
}
