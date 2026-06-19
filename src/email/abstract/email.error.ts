export const EMAIL_ERRORS = {
  UNKNOWN: 'EMAIL_UNKNOWN',
  INVALID_PARAMS: 'EMAIL_INVALID_PARAMS',
  INVALID_RECIPIENT: 'EMAIL_INVALID_RECIPIENT',
  TEMPLATE_NOT_FOUND: 'EMAIL_TEMPLATE_NOT_FOUND',
  TEMPLATE_RENDER_FAILED: 'EMAIL_TEMPLATE_RENDER_FAILED',
  PROVIDER_AUTH_FAILED: 'EMAIL_PROVIDER_AUTH_FAILED',
  PROVIDER_REJECTED: 'EMAIL_PROVIDER_REJECTED',
  PROVIDER_UNAVAILABLE: 'EMAIL_PROVIDER_UNAVAILABLE',
  QUOTA_EXCEEDED: 'EMAIL_QUOTA_EXCEEDED',
} as const;

export type EmailErrorCode = (typeof EMAIL_ERRORS)[keyof typeof EMAIL_ERRORS];

export class EmailError extends Error {
  constructor(
    public readonly code: EmailErrorCode,
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EmailError';
  }
}
