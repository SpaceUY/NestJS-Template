import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3AdapterService {
  private s3: S3Client;
  private region: string;
  private bucket: string;
  private expiresInSeconds: number;
  private readonly logger = new Logger(this.constructor.name, {
    timestamp: true,
  });

  constructor() {
    this.expiresInSeconds = 3600;
    this.bucket = process.env.AWS_S3_BUCKET_NAME!;
    this.region = process.env.AWS_REGION!;
    this.s3 = new S3Client({
      region: process.env.AWS_REGION!, // TODO: Configure globally congis?
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: file.filename,
        Body: file.buffer,
        ContentType: file.mimetype,
      };
      await this.s3.send(new PutObjectCommand(params));
      const fileUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${params.Key}`;
      return fileUrl;
    } catch (error) {
      this.logger.error(
        `Failed to upload object ${file.filename} to bucket ${this.bucket}:`,
        error,
      );
      throw error;
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: fileName,
      };
      await this.s3.send(new DeleteObjectCommand(params));
    } catch (error) {
      this.logger.error(
        `Failed to delete object ${fileName} from bucket ${this.bucket}:`,
        error,
      );
      throw error;
    }
  }

  async getFile(fileName: string): Promise<string> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: fileName,
      };
      const url = await getSignedUrl(this.s3, new GetObjectCommand(params), {
        expiresIn: this.expiresInSeconds,
      });
      return url;
    } catch (error) {
      this.logger.error(
        `Failed to get object ${fileName} from bucket ${this.bucket}:`,
        error,
      );
      throw error;
    }
  }
}
