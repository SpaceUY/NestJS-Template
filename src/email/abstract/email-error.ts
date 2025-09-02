export enum EmailErrorCode {
  Unknown = 'UNKNOWN',
  InvalidParams = 'INVALID_PARAMS',
  InvalidRecipient = 'INVALID_RECIPIENT',
  TemplateNotFound = 'TEMPLATE_NOT_FOUND',
  TemplateRenderFailed = 'TEMPLATE_RENDER_FAILED',
  ProviderAuthFailed = 'PROVIDER_AUTH_FAILED',
  ProviderRejected = 'PROVIDER_REJECTED',
  ProviderUnavailable = 'PROVIDER_UNAVAILABLE',
  QuotaExceeded = 'QUOTA_EXCEEDED',
}

export class EmailError extends Error {
  readonly code: EmailErrorCode;
  readonly cause?: unknown;

  constructor(
    message: string,
    code: EmailErrorCode = EmailErrorCode.Unknown,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'EmailError';
    this.code = code;
    this.cause = cause;
  }
}
