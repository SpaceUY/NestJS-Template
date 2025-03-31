import {
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
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
import { RequestException } from 'src/common/exception/core/ExceptionBase';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudStorageService } from './cloud-storage.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { CloudStorageException } from './cloud-storage.exception';
import { CLOUD_STORAGE_ERRORS } from './cloud-storage-error-codes';
import { FileResponseDto } from './dto/file-response.dto';

@ApiTags('Cloud Storage')
@Controller('cloud-storage')
// Use an authentication guard if the project requires it.
export class CloudStorageController {
  private readonly logger = new Logger(this.constructor.name, {
    timestamp: true,
  });

  constructor(private cloudStorageService: CloudStorageService) {}

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
      if (!file) {
        throw new CloudStorageException(
          CLOUD_STORAGE_ERRORS.FILE_REQUIRED.message,
          CLOUD_STORAGE_ERRORS.FILE_REQUIRED.code,
          CLOUD_STORAGE_ERRORS.FILE_REQUIRED.status,
        );
      }
      return await this.cloudStorageService.uploadFile(file);
    } catch (error) {
      this.logger.error('Cloud Storage Controller - uploadFile: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }

  @Delete(':fileKey')
  @ApiParam({ name: 'fileKey' })
  @ApiOperation({ summary: 'Delete from cloud storage by file key' })
  @ApiResponse({ status: 200, description: 'Complete', type: String })
  async deleteFile(@Param('fileKey') fileKey: string): Promise<string> {
    try {
      await this.cloudStorageService.deleteFile(fileKey);
      return 'Remove File successfully';
    } catch (error) {
      this.logger.error('Cloud Storage Controller - deleteFile: ', error);
      if (error instanceof RequestException) {
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
      return await this.cloudStorageService.getFile(fileKey);
    } catch (error) {
      this.logger.error('Cloud Storage Controller - getFile: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }
}
