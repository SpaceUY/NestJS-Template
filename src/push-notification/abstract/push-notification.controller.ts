import {
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PushNotificationService } from './push-notification.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { PushNotificationException } from './push-notification.exception';
import { PUSH_NOTIFICATION_ERRORS } from './push-notification-error-codes';
import { FileResponseDto } from './dto/file-response.dto';

@ApiTags('Push Notification')
@Controller('push-notification')
// Use an authentication guard if the project requires it.
export class PushNotificationController {
  constructor(
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  @Post('')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFileDto })
  @ApiOperation({
    summary: 'Upload new file to cloud storage',
  })
  @ApiResponse({ status: 200, description: 'Complete' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileResponseDto> {
    try {
      // if (!file) {
      //   throw new PushNotificationException(
      //     CLOUD_STORAGE_ERRORS.FILE_REQUIRED.message,
      //     CLOUD_STORAGE_ERRORS.FILE_REQUIRED.code,
      //     CLOUD_STORAGE_ERRORS.FILE_REQUIRED.status,
      //   );
      // }
      return await this.pushNotificationService.uploadFile(file);
    } catch (error) {
      if (error instanceof PushNotificationException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }

  @Delete(':fileKey')
  @ApiParam({ name: 'fileKey' })
  @ApiOperation({ summary: 'Delete from cloud storage by file key' })
  @ApiResponse({ status: 200, description: 'Complete', type: String })
  async deleteFile(@Param('fileKey') fileKey: string): Promise<void> {
    try {
      await this.pushNotificationService.deleteFile(fileKey);
    } catch (error) {
      if (error instanceof PushNotificationException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }

  @Get(':fileKey')
  @ApiParam({ name: 'fileKey' })
  @ApiOperation({ summary: 'Get file from cloud storage by file key' })
  @ApiResponse({ status: 200, description: 'Complete', type: FileResponseDto })
  async getFile(@Param('fileKey') fileKey: string): Promise<FileResponseDto> {
    try {
      return await this.pushNotificationService.getFile(fileKey);
    } catch (error) {
      if (error instanceof PushNotificationException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }
}
