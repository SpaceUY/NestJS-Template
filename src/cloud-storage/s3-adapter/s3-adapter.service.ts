import { Injectable } from "@nestjs/common";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import {
  CloudStorageFile,
  CloudStorageService,
  CloudStorageUploadFile,
} from "../abstract/cloud-storage.service";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3AdapterConfig } from "./s3-adapter-config.interface";

type GetSignedUrlCompat = (
  client: S3Client,
  command: GetObjectCommand,
  options: { expiresIn: number },
) => Promise<string>;

const getSignedUrlCompat = getSignedUrl as unknown as GetSignedUrlCompat;

@Injectable()
export class S3AdapterService extends CloudStorageService {
  private readonly region: string;
  private readonly bucket: string;
  private readonly expiresInSeconds: number;
  readonly s3: S3Client;

  constructor(config: S3AdapterConfig) {
    super();
    this.expiresInSeconds = config.expiresInSeconds;
    this.bucket = config.bucket;
    this.region = config.region;
    const credentials =
      config.accessKeyId && config.secretAccessKey
        ? {
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          }
        : {};
    this.s3 = new S3Client({
      region: this.region,
      ...credentials,
    });
  }

  async uploadFile(file: CloudStorageUploadFile): Promise<CloudStorageFile> {
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
  }

  async deleteFile(fileKey: string): Promise<void> {
    const params = {
      Bucket: this.bucket,
      Key: fileKey,
    };
    await this.s3.send(new DeleteObjectCommand(params));
  }

  async getFile(fileKey: string): Promise<CloudStorageFile> {
    const params = {
      Bucket: this.bucket,
      Key: fileKey,
    };

    // AWS SDK packages can pull different @smithy type instances in some installs.
    // This keeps runtime behavior with the real helper while avoiding false type incompatibilities.
    const url = await getSignedUrlCompat(this.s3, new GetObjectCommand(params), {
      expiresIn: this.expiresInSeconds,
    });

    return { url, id: fileKey };
  }
}
