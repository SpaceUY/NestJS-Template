import type { Buffer } from "node:buffer";

/**
 * Interface for the file object returned by the Cloud Storage provider.
 * @property {string} url - The public URL where the file can be accessed.
 * @property {string} id - The unique identifier assigned to the file in the cloud provider.
 */
export interface CloudStorageFile {
  url: string;
  id: string;
}

/**
 * File payload contract accepted by cloud storage adapters.
 */
export interface CloudStorageUploadFile {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
  size?: number;
}

export interface UploadedFileWithBuffer extends CloudStorageUploadFile {}
