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

export interface EmailError {
  name: 'EmailError';
  message: string;
  code: EmailErrorCode;
  cause?: unknown;
}

export function createEmailError(
  message: string,
  code: EmailErrorCode = EmailErrorCode.Unknown,
  cause?: unknown,
): EmailError {
  return {
    name: 'EmailError',
    message,
    code,
    cause,
  };
}
