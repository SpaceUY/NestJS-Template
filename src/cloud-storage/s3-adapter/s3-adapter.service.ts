import { Inject, Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { S3_ADAPTER_PROVIDER_CONFIG } from './s3-adapter-config-provider.const';
import { S3AdapterConfig } from './s3-adapter-config.interface';

@Injectable()
export class S3AdapterService {
  private s3: S3Client;
  private region: string;
  private bucket: string;
  private expiresInSeconds: number;

  constructor(
    @Inject(S3_ADAPTER_PROVIDER_CONFIG)
    private readonly config: S3AdapterConfig,
  ) {
    this.expiresInSeconds = config.expiresInSeconds;
    this.bucket = config.bucket;
    this.region = config.region;
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
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
      console.log(
        `Failed to upload object to bucket ${this.bucket}:`,
        `Error: ${error}`,
      ); // TODO: Integrate log provider
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
      console.log(
        `Failed to delete object ${fileKey} from bucket ${this.bucket}:`,
        `Error: ${error}`,
      ); // TODO: Integrate log provider
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
      console.log(
        `Failed to get object ${fileKey} from bucket ${this.bucket}:`,
        `Error: ${error}`,
      ); // TODO: Integrate log provider
      throw error;
    }
  }
}
