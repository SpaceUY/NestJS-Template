import { ERROR_CODES } from "@/common/enums";
import { ApiException } from "@/common/expections/api.exception";
import { Controller, Delete, Get, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CloudStorageService, CloudStorageUploadFile } from "./cloud-storage.service";
import { FileResponseDto } from "./dto/file-response.dto";
import { UploadFileDto } from "./dto/upload-file.dto";

export interface UploadedFileWithBuffer extends CloudStorageUploadFile {}

@ApiTags("Cloud Storage")
@Controller("cloud-storage")
export class CloudStorageController {
  constructor(
    private readonly cloudStorageService: CloudStorageService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UploadFileDto })
  @ApiOperation({
    summary: "Upload new file to cloud storage",
  })
  @ApiResponse({ status: 200, description: "Complete", type: FileResponseDto })
  async uploadFile(
    @UploadedFile() file: UploadedFileWithBuffer | undefined,
  ): Promise<FileResponseDto> {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new ApiException({
        code: ERROR_CODES.INSUFFICIENT_INFORMATION,
        message: "A non-empty file is required",
      });
    }

    return this.cloudStorageService.uploadFile(file);
  }

  @Delete(":fileKey")
  @ApiParam({ name: "fileKey" })
  @ApiOperation({ summary: "Delete from cloud storage by file key" })
  @ApiResponse({ status: 200, description: "Complete", type: String })
  async deleteFile(@Param("fileKey") fileKey: string): Promise<void> {
    if (!fileKey?.trim()) {
      throw new ApiException({
        code: ERROR_CODES.INSUFFICIENT_INFORMATION,
        message: "A valid file key is required",
      });
    }

    await this.cloudStorageService.deleteFile(fileKey);
  }

  @Get(":fileKey")
  @ApiParam({ name: "fileKey" })
  @ApiOperation({ summary: "Get file from cloud storage by file key" })
  @ApiResponse({ status: 200, description: "Complete", type: FileResponseDto })
  async getFile(@Param("fileKey") fileKey: string): Promise<FileResponseDto> {
    if (!fileKey?.trim()) {
      throw new ApiException({
        code: ERROR_CODES.INSUFFICIENT_INFORMATION,
        message: "A valid file key is required",
      });
    }

    return this.cloudStorageService.getFile(fileKey);
  }
}
