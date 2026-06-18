import { CLOUD_STORAGE_ERRORS, CloudStorageError } from './cloud-storage.error';

describe('CloudStorageError', () => {
  it('should be an Error instance with the correct name, code, and message', () => {
    const error = new CloudStorageError(CLOUD_STORAGE_ERRORS.UPLOAD_FAILED, 'Upload failed');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CloudStorageError');
    expect(error.code).toBe('CLOUD_STORAGE_UPLOAD_FAILED');
    expect(error.message).toBe('Upload failed');
    expect(error.data).toBeUndefined();
  });

  it('should carry data when provided', () => {
    const error = new CloudStorageError(
      CLOUD_STORAGE_ERRORS.FILE_NOT_FOUND,
      'File not found',
      { key: 'abc.pdf' },
    );

    expect(error.data).toEqual({ key: 'abc.pdf' });
  });
});
