import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

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

  async uploadFile(
    file: Express.Multer.File,
  ): Promise<{ url: string; id: string }> {
    try {
      const id = uuidv4();
      const params = {
        Bucket: this.bucket,
        Key: id,
        Body: file.buffer,
        ContentType: file.mimetype,
      };
      await this.s3.send(new PutObjectCommand(params));
      const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${params.Key}`;
      return { url, id };
    } catch (error) {
      this.logger.error(
        `Failed to upload object to bucket ${this.bucket}:`,
        error,
      );
      throw error;
    }
  }

  async deleteFile(fileKey: string): Promise<void> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: fileKey,
      };
      await this.s3.send(new DeleteObjectCommand(params));
    } catch (error) {
      this.logger.error(
        `Failed to delete object ${fileKey} from bucket ${this.bucket}:`,
        error,
      );
      throw error;
    }
  }

  async getFile(fileKey: string): Promise<{ url: string; id: string }> {
    try {
      const params = {
        Bucket: this.bucket,
        Key: fileKey,
      };
      const url = await getSignedUrl(this.s3, new GetObjectCommand(params), {
        expiresIn: this.expiresInSeconds,
      });
      return { url, id: fileKey };
    } catch (error) {
      this.logger.error(
        `Failed to get object ${fileKey} from bucket ${this.bucket}:`,
        error,
      );
      throw error;
    }
  }
}
