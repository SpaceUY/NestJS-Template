import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class S3AdapterService {
  private s3: S3Client;
  private region: string;
  private readonly logger = new Logger(this.constructor.name, {
    timestamp: true,
  });

  constructor() {
    this.region = process.env.AWS_REGION!;
    this.s3 = new S3Client({
      region: process.env.AWS_REGION!, // TODO: Como vamos a acomodar los config?
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    fileKey: string,
    bucket: string,
  ): Promise<string> {
    try {
      const params = {
        Bucket: bucket,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      };
      await this.s3.send(new PutObjectCommand(params));
      const fileUrl = `https://${bucket}.s3.${this.region}.amazonaws.com/${params.Key}`;
      return fileUrl;
    } catch (error) {
      this.logger.error(
        `Failed to upload object ${fileKey} to bucket ${bucket}:`,
        error,
      );
      throw error;
    }
  }

  async deleteFile(bucket: string, key: string): Promise<void> {
    try {
      const params = {
        Bucket: bucket,
        Key: key,
      };
      await this.s3.send(new DeleteObjectCommand(params));
    } catch (error) {
      this.logger.error(
        `Failed to delete object ${key} from bucket ${bucket}:`,
        error,
      );
      throw error;
    }
  }

  async getFileUrl(bucket: string, key: string): Promise<void> {
    try {
      const params = {
        Bucket: bucket,
        Key: key,
      };
      await this.s3.send(new GetObjectCommand(params));
    } catch (error) {
      this.logger.error(
        `Failed to get object ${key} from bucket ${bucket}:`,
        error,
      );
      throw error;
    }
  }
}
