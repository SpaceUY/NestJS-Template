import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { CloudStorageService } from '../abstract/cloud-storage.service';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type S3AdapterConfig } from './s3-adapter-config.interface';
import {
  CloudStorageFile,
  CloudStorageUploadFile,
} from '../abstract/cloud-storage.interfaces';
import {
  CloudStorageError,
  CLOUD_STORAGE_ERRORS,
} from '../abstract/cloud-storage.error';

type GetSignedUrlCompat = (
  client: S3Client,
  command: GetObjectCommand,
  options: { expiresIn: number },
) => Promise<string>;

const getSignedUrlCompat = getSignedUrl as unknown as GetSignedUrlCompat;

/** Either explicit static credentials, or nothing — letting the SDK's own
 * provider chain (instance role, profile, environment) take over. */
type S3ClientCredentials =
  | { credentials: { accessKeyId: string; secretAccessKey: string } }
  | Record<string, never>;

@Injectable()
export class S3AdapterService extends CloudStorageService {
  private readonly region: string;
  private readonly bucket: string;
  private readonly expiresInSeconds: number;
  private readonly credentials: S3ClientCredentials;
  private client?: S3Client;

  constructor(config: S3AdapterConfig) {
    super();
    this.expiresInSeconds = config.expiresInSeconds;
    this.bucket = config.bucket;
    this.region = config.region;
    this.credentials =
      config.accessKeyId && config.secretAccessKey
        ? {
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          }
        : {};
  }

  /**
   * The S3 client, built on first use and cached.
   *
   * Deliberately not built in the constructor. Every field of `s3Scope`
   * defaults to an empty string, and `new S3Client({ region: '' })` throws
   * `Error: Region is missing` — so an eager client made an unconfigured S3
   * block a startup crash for the whole application, including for a project
   * that never uploads a file. Building it here keeps the promise
   * `.env.example` makes about this block: it is optional, and it fails when
   * you actually call it.
   *
   * @returns {S3Client} The cached client.
   * @throws {CloudStorageError} With code NOT_CONFIGURED when no region is set.
   */
  private get s3(): S3Client {
    if (this.client) return this.client;

    if (!this.region) {
      throw new CloudStorageError(
        CLOUD_STORAGE_ERRORS.NOT_CONFIGURED,
        'S3 is not configured: set AWS_REGION (and a bucket) before using cloud storage',
      );
    }

    this.client = new S3Client({ region: this.region, ...this.credentials });
    return this.client;
  }

  async uploadFile(file: CloudStorageUploadFile): Promise<CloudStorageFile> {
    const id = uuidv4();
    const params = {
      Bucket: this.bucket,
      Key: id,
      Body: file.buffer,
      ContentType: file.mimetype,
    };
    try {
      await this.s3.send(new PutObjectCommand(params));
    } catch (error) {
      // A CloudStorageError here is this adapter's own — NOT_CONFIGURED from
      // the lazy client — and re-wrapping it would bury the one message that
      // says what to set.
      if (error instanceof CloudStorageError) throw error;
      throw new CloudStorageError(
        CLOUD_STORAGE_ERRORS.UPLOAD_FAILED,
        'File upload to S3 failed',
        { cause: String(error) },
      );
    }
    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${params.Key}`;
    return { url, id };
  }

  async deleteFile(fileKey: string): Promise<void> {
    const params = {
      Bucket: this.bucket,
      Key: fileKey,
    };
    try {
      await this.s3.send(new DeleteObjectCommand(params));
    } catch (error) {
      // A CloudStorageError here is this adapter's own — NOT_CONFIGURED from
      // the lazy client — and re-wrapping it would bury the one message that
      // says what to set.
      if (error instanceof CloudStorageError) throw error;
      throw new CloudStorageError(
        CLOUD_STORAGE_ERRORS.DELETE_FAILED,
        'File deletion from S3 failed',
        { cause: String(error) },
      );
    }
  }

  async getFile(fileKey: string): Promise<CloudStorageFile> {
    const params = {
      Bucket: this.bucket,
      Key: fileKey,
    };

    // AWS SDK packages can pull different @smithy type instances in some installs.
    // This keeps runtime behavior with the real helper while avoiding false type incompatibilities.
    try {
      const url = await getSignedUrlCompat(
        this.s3,
        new GetObjectCommand(params),
        { expiresIn: this.expiresInSeconds },
      );
      return { url, id: fileKey };
    } catch (error) {
      // A CloudStorageError here is this adapter's own — NOT_CONFIGURED from
      // the lazy client — and re-wrapping it would bury the one message that
      // says what to set.
      if (error instanceof CloudStorageError) throw error;
      throw new CloudStorageError(
        CLOUD_STORAGE_ERRORS.GET_FAILED,
        'Failed to generate signed URL from S3',
        { cause: String(error) },
      );
    }
  }
}
