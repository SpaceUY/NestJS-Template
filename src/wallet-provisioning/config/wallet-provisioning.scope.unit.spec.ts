import {
  walletProvisioningScope,
  WalletProvisioningScopeConfig,
} from './wallet-provisioning.scope';

const validate = (
  raw: Record<string, unknown>,
): WalletProvisioningScopeConfig => {
  if (!walletProvisioningScope.validate) {
    throw new Error('walletProvisioning scope has no validator');
  }
  return walletProvisioningScope.validate(raw);
};

describe('walletProvisioningScope', () => {
  it('defaults to 60 seconds and 30 minutes', () => {
    expect(validate({})).toEqual({
      requestDedupeSeconds: 60,
      claimWindowMinutes: 30,
    });
  });

  it('carries configured values through', () => {
    expect(
      validate({ requestDedupeSeconds: 120, claimWindowMinutes: 10 }),
    ).toEqual({ requestDedupeSeconds: 120, claimWindowMinutes: 10 });
  });

  it.each(['requestDedupeSeconds', 'claimWindowMinutes'])(
    'refuses zero, negative and fractional values for %s',
    (field) => {
      for (const value of [0, -1, 1.5, 'soon']) {
        expect(() => validate({ [field]: value })).toThrow(new RegExp(field));
      }
    },
  );

  it('treats blank values, as copied from .env.example, as unset', () => {
    expect(
      validate({ requestDedupeSeconds: '', claimWindowMinutes: '' }),
    ).toEqual({
      requestDedupeSeconds: 60,
      claimWindowMinutes: 30,
    });
  });
});
