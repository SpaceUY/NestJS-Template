import { EMAIL_ERRORS, EmailError } from './email-error';

describe('EmailError', () => {
  it('should be an Error instance with the correct name, code, and message', () => {
    const error = new EmailError(EMAIL_ERRORS.PROVIDER_REJECTED, 'Provider rejected the request');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('EmailError');
    expect(error.code).toBe('EMAIL_PROVIDER_REJECTED');
    expect(error.message).toBe('Provider rejected the request');
    expect(error.cause).toBeUndefined();
  });

  it('should carry cause when provided', () => {
    const cause = new Error('original');
    const error = new EmailError(EMAIL_ERRORS.UNKNOWN, 'Something went wrong', cause);

    expect(error.cause).toBe(cause);
  });
});
