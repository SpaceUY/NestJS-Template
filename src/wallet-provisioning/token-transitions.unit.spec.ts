import {
  WalletProvisioningStatus,
  TokenEvent,
} from './abstract/wallet-provisioning.types';
import { nextStatus, nextStatusReason } from './token-transitions';

const event = (overrides: Partial<TokenEvent>): TokenEvent => ({
  cardExternalId: 'crd-1',
  tokenExternalId: 'tok-1',
  wallet: 'GOOGLE_PAY',
  kind: 'LIFECYCLE',
  ...overrides,
});

const PENDING: WalletProvisioningStatus[] = [
  'REQUESTED',
  'OTP_PENDING',
  'OTP_SENT',
];
const PROVISIONED: WalletProvisioningStatus[] = [
  'ACTIVATED',
  'SUSPENDED',
  'DISABLED',
  'INACTIVE',
];

describe('nextStatus', () => {
  it('LIFECYCLE sets the status it carries', () => {
    expect(nextStatus('REQUESTED', event({ status: 'OTP_SENT' }))).toBe(
      'OTP_SENT',
    );
    expect(nextStatus('ACTIVATED', event({ status: 'SUSPENDED' }))).toBe(
      'SUSPENDED',
    );
  });

  it('LIFECYCLE without a status keeps the current one', () => {
    expect(nextStatus('OTP_SENT', event({}))).toBe('OTP_SENT');
  });

  it.each(PROVISIONED)('a late OTP status does not overwrite %s', (current) => {
    expect(nextStatus(current, event({ status: 'OTP_PENDING' }))).toBe(current);
    expect(nextStatus(current, event({ status: 'OTP_SENT' }))).toBe(current);
  });

  it.each([...PENDING, 'ABANDONED' as const])(
    'COMPLETED activates a %s row',
    (current) => {
      expect(nextStatus(current, event({ kind: 'COMPLETED' }))).toBe(
        'ACTIVATED',
      );
    },
  );

  it.each(['SUSPENDED', 'DISABLED', 'FAILED'] as const)(
    'COMPLETED leaves a %s row',
    (current) => {
      expect(nextStatus(current, event({ kind: 'COMPLETED' }))).toBe(current);
    },
  );

  it.each(PENDING)('ABANDONED applies over a %s row', (current) => {
    expect(nextStatus(current, event({ kind: 'ABANDONED' }))).toBe('ABANDONED');
  });

  it('ABANDONED does not overwrite ACTIVATED', () => {
    expect(nextStatus('ACTIVATED', event({ kind: 'ABANDONED' }))).toBe(
      'ACTIVATED',
    );
  });
});

describe('nextStatusReason', () => {
  it('keeps the reason of an applied lifecycle event', () => {
    expect(
      nextStatusReason(
        'old',
        event({ status: 'SUSPENDED', statusReason: 'FRAUD' }),
        'SUSPENDED',
      ),
    ).toBe('FRAUD');
  });

  it('clears an old status reason on a lifecycle event without one', () => {
    expect(
      nextStatusReason('FRAUD', event({ status: 'ACTIVATED' }), 'ACTIVATED'),
    ).toBeNull();
  });

  it('keeps the row reason when the lifecycle status was not applied', () => {
    expect(
      nextStatusReason('FRAUD', event({ status: 'OTP_SENT' }), 'ACTIVATED'),
    ).toBe('FRAUD');
  });

  it('keeps the row reason on notifications', () => {
    expect(
      nextStatusReason('FRAUD', event({ kind: 'COMPLETED' }), 'ACTIVATED'),
    ).toBe('FRAUD');
  });
});
