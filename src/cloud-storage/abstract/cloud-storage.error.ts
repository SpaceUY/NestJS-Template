export const CLOUD_STORAGE_ERRORS = {
  UPLOAD_FAILED: 'CLOUD_STORAGE_UPLOAD_FAILED',
  DELETE_FAILED: 'CLOUD_STORAGE_DELETE_FAILED',
  GET_FAILED: 'CLOUD_STORAGE_GET_FAILED',
  FILE_NOT_FOUND: 'CLOUD_STORAGE_FILE_NOT_FOUND',
  INVALID_KEY: 'CLOUD_STORAGE_INVALID_KEY',
} as const;

export type CloudStorageErrorCode =
  (typeof CLOUD_STORAGE_ERRORS)[keyof typeof CLOUD_STORAGE_ERRORS];

export class CloudStorageError extends Error {
  constructor(
    public readonly code: CloudStorageErrorCode,
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CloudStorageError';
  }
}
