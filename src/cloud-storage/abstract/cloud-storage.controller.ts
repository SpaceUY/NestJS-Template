import {
  BadRequestException,
  Body,
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
  ApiBearerAuth,
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

@ApiTags('Cloud Storage')
@Controller('cloud-storage')
export class CloudStorageController {
  private readonly logger = new Logger(this.constructor.name, {
    timestamp: true,
  });

  constructor(private cloudStorageService: CloudStorageService) {}

  @Post('')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiBody({ type: UploadFileDto })
  // @UseGuards(JwtAuthGuard) // TODO: guard?
  @ApiOperation({
    summary: 'Upload new file to cloud storage',
  })
  @ApiResponse({ status: 200, description: 'Complete' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: UploadFileDto,
  ): Promise<string> {
    try {
      if (!file) {
        throw new BadRequestException('A File is required');
      }
      await this.cloudStorageService.uploadFile(file);
      return 'Upload File successfully';
    } catch (error) {
      this.logger.error('Cloud Storage Controller - uploadFile: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }

  @Delete(':fileName')
  @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard) // TODO: Guard?
  @ApiParam({ name: 'fileName' })
  @ApiOperation({ summary: 'Delete a File by path' })
  @ApiResponse({ status: 200, description: 'Complete', type: String })
  async deleteFile(@Param('fileName') fileName: string): Promise<string> {
    try {
      await this.cloudStorageService.deleteFile(fileName);
      return 'Remove File successfully';
    } catch (error) {
      this.logger.error('Cloud Storage Controller - deleteFile: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }

  @ApiParam({ name: 'fileName' })
  @Get(':fileName')
  async getFile(@Param('fileName') fileName: string): Promise<any> {
    // TODO: TYPE
    try {
      await this.cloudStorageService.getFile(fileName);
      return 'Remove File successfully';
    } catch (error) {
      this.logger.error('Cloud Storage Controller - getFile: ', error);
      if (error instanceof RequestException) {
        throw error;
      }
      throw new InternalServerErrorException(error);
    }
  }
}
