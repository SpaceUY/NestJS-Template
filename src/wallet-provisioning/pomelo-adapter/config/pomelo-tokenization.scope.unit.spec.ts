import {
  pomeloTokenizationScope,
  PomeloTokenizationScopeConfig,
} from './pomelo-tokenization.scope';

const validate = (
  raw: Record<string, unknown>,
): PomeloTokenizationScopeConfig => {
  if (!pomeloTokenizationScope.validate) throw new Error('no validator');
  return pomeloTokenizationScope.validate(raw);
};

const required = {
  baseUrl: 'https://api.pomelo.example',
  clientId: 'client',
  clientSecret: 'secret',
  audience: 'https://auth.pomelo.example',
  webhookApiSecret: 'c2VjcmV0',
};

describe('pomeloTokenizationScope', () => {
  it.each(Object.keys(required))('requires %s', (field) => {
    const raw: Record<string, unknown> = { ...required };
    delete raw[field];
    expect(() => validate(raw)).toThrow(new RegExp(field));
  });

  it('defaults the timeout to 6500 ms, no IP list and the known Pomelo paths', () => {
    expect(validate(required)).toEqual({
      ...required,
      allowedIps: [],
      requestTimeoutMs: 6500,
      mastercardApplePayPath: '/token-provisioning/mastercard/apple-pay',
      mastercardGooglePayPath: '/token-provisioning/v2/mastercard/google-pay',
      visaApplePayPath: '/token-provisioning/v2/visa/apple-pay',
    });
  });

  it('rejects a timeout of 7000 ms or more', () => {
    expect(() => validate({ ...required, requestTimeoutMs: 7000 })).toThrow(
      /requestTimeoutMs/,
    );
    expect(
      validate({ ...required, requestTimeoutMs: 6900 }).requestTimeoutMs,
    ).toBe(6900);
  });

  it('parses POMELO_ALLOWED_IPS as a comma-separated list', () => {
    expect(
      validate({ ...required, allowedIps: '1.2.3.4, 5.6.7.8' }).allowedIps,
    ).toEqual(['1.2.3.4', '5.6.7.8']);
  });

  it('accepts a Visa Google Pay path once Pomelo confirms it', () => {
    expect(
      validate({
        ...required,
        visaGooglePayPath: '/token-provisioning/v2/visa/google-pay',
      }).visaGooglePayPath,
    ).toBe('/token-provisioning/v2/visa/google-pay');
  });
});
