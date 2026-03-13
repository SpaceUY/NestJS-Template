import { ERROR_CODES } from "@/common/enums";
import { ApiException } from "@/common/expections/api.exception";
import { Injectable } from "@nestjs/common";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { v4 as uuidv4 } from "uuid";
import {
  CloudStorageFile,
  CloudStorageService,
  CloudStorageUploadFile,
} from "../abstract/cloud-storage.service";

const LOCAL_FILES_DIRECTORY = resolve(process.cwd(), "files");
const LOCAL_FILES_PUBLIC_PREFIX = "/files";

function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as NodeJS.ErrnoException).code === "ENOENT";
}

@Injectable()
export class LocalAdapterService extends CloudStorageService {
  async uploadFile(file: CloudStorageUploadFile): Promise<CloudStorageFile> {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new ApiException({
        code: ERROR_CODES.INSUFFICIENT_INFORMATION,
        message: "A non-empty file is required",
      });
    }

    await mkdir(LOCAL_FILES_DIRECTORY, { recursive: true });

    const extension = extname(file.originalname ?? "");
    const id = `${uuidv4()}${extension}`;
    const filePath = this._resolveLocalPath(id);

    await writeFile(filePath, file.buffer);

    return {
      id,
      url: this._buildLocalUrl(id),
    };
  }

  async deleteFile(fileKey: string): Promise<void> {
    const filePath = this._resolveLocalPath(fileKey);

    try {
      await unlink(filePath);
    }
    catch (error) {
      if (isFileNotFoundError(error)) {
        throw new ApiException({
          code: ERROR_CODES.RESOURCE_NOT_FOUND,
          message: "File not found in local storage",
          data: { fileKey },
        });
      }
      throw error;
    }
  }

  async getFile(fileKey: string): Promise<CloudStorageFile> {
    const filePath = this._resolveLocalPath(fileKey);
    const normalizedFileKey = basename(decodeURIComponent(fileKey));

    try {
      await access(filePath);
    }
    catch (error) {
      if (isFileNotFoundError(error)) {
        throw new ApiException({
          code: ERROR_CODES.RESOURCE_NOT_FOUND,
          message: "File not found in local storage",
          data: { fileKey: normalizedFileKey },
        });
      }
      throw error;
    }

    return {
      id: normalizedFileKey,
      url: this._buildLocalUrl(normalizedFileKey),
    };
  }

  private _buildLocalUrl(fileKey: string): string {
    return `${LOCAL_FILES_PUBLIC_PREFIX}/${encodeURIComponent(fileKey)}`;
  }

  private _resolveLocalPath(fileKey: string): string {
    if (!fileKey?.trim()) {
      throw new ApiException({
        code: ERROR_CODES.INVALID_PAYLOAD,
        message: "A valid file key is required",
      });
    }

    const decodedFileKey = decodeURIComponent(fileKey);
    const normalizedFileKey = basename(decodedFileKey);

    if (normalizedFileKey !== decodedFileKey) {
      throw new ApiException({
        code: ERROR_CODES.INVALID_PAYLOAD,
        message: "Invalid file key path",
        data: { fileKey },
      });
    }

    return join(LOCAL_FILES_DIRECTORY, normalizedFileKey);
  }
}
