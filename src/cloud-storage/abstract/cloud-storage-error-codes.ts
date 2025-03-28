export const CLOUD_STORAGE_ERRORS = {
  FILE_REQUIRED: {
    code: 'CLOUD_STORAGE_FILE_REQUIRED',
    status: 400,
    message: 'A file is required',
  },
  FILE_TOO_LARGE: {
    code: 'CLOUD_STORAGE_FILE_TOO_LARGE',
    status: 413,
    message: 'The file is too large',
  },
  UPLOAD_FAILED: {
    code: 'CLOUD_STORAGE_UPLOAD_FAILED',
    status: 500,
    message: 'File upload failed',
  },
};
