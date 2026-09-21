import { s3Scope, S3ScopeConfig } from './s3.scope';

const validate = (raw: Record<string, unknown>): S3ScopeConfig => {
  if (!s3Scope.validate) throw new Error('s3 scope has no validator');
  return s3Scope.validate(raw);
};

describe('s3Scope', () => {
  it('carries a complete configuration through, coercing the expiry', () => {
    expect(
      validate({
        bucket: 'a-bucket',
        region: 'us-east-1',
        accessKeyId: 'AKIAEXAMPLE',
        secretAccessKey: 'a-secret',
        expiresInSeconds: '900',
      }),
    ).toEqual({
      bucket: 'a-bucket',
      region: 'us-east-1',
      accessKeyId: 'AKIAEXAMPLE',
      secretAccessKey: 'a-secret',
      expiresInSeconds: 900,
    });
  });

  // Every field is optional by design: the template boots with cloud storage
  // unconfigured and the S3 SDK is what complains on the first call. What
  // matters here is that the blanks are blanks — the scope ships no baked-in
  // bucket, region or credential of its own (`T4`).
  it('defaults every field to empty and never invents a credential', () => {
    expect(validate({})).toEqual({
      bucket: '',
      region: '',
      accessKeyId: '',
      secretAccessKey: '',
      expiresInSeconds: 3600,
    });
  });

  it('refuses a presign expiry that is not a number', () => {
    expect(() => validate({ expiresInSeconds: 'an-hour' })).toThrow(
      /expiresInSeconds/,
    );
  });

  it('refuses a fractional presign expiry', () => {
    expect(() => validate({ expiresInSeconds: 3600.5 })).toThrow(/integer/);
  });

  it('refuses a non-string bucket', () => {
    expect(() => validate({ bucket: 42 })).toThrow(/bucket/);
  });

  it('refuses a key the scope does not declare', () => {
    expect(() => validate({ secretKey: 'a-secret' })).toThrow(/secretKey/);
  });
});
