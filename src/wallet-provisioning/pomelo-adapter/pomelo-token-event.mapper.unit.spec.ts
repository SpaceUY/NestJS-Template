import {
  toTokenEventFromLifecycle,
  toTokenEventFromNotification,
  toWalletProvider,
} from './pomelo-token-event.mapper';

const base = {
  card_id: 'crd-1',
  user_id: 'usr-1',
  token_external_id: 'tok-1',
  origin: 'GOOGLE_PAY',
  idempotency_key: 'k',
};

describe('Pomelo token event mapper', () => {
  it.each([
    'OTP_PENDING',
    'OTP_SENT',
    'ACTIVATED',
    'SUSPENDED',
    'DISABLED',
    'INACTIVE',
  ])('maps the %s lifecycle status', (status) => {
    expect(
      toTokenEventFromLifecycle({
        ...base,
        event_id: 'e',
        status,
        token_status_reason: 'R',
      }),
    ).toEqual({
      cardExternalId: 'crd-1',
      tokenExternalId: 'tok-1',
      wallet: 'GOOGLE_PAY',
      kind: 'LIFECYCLE',
      status,
      statusReason: 'R',
    });
  });

  it('maps completed and abandoned notifications', () => {
    expect(
      toTokenEventFromNotification({
        ...base,
        event_id: 'tokenization-completed-notification',
      })?.kind,
    ).toBe('COMPLETED');
    expect(
      toTokenEventFromNotification({
        ...base,
        event_id: 'tokenization-abandoned-notification',
      })?.kind,
    ).toBe('ABANDONED');
  });

  it('returns null for an unknown status or event_id', () => {
    expect(
      toTokenEventFromLifecycle({
        ...base,
        event_id: 'e',
        status: 'NEW_STATUS',
      }),
    ).toBeNull();
    expect(
      toTokenEventFromNotification({ ...base, event_id: 'tokenization-other' }),
    ).toBeNull();
  });

  it('returns null when card_id or token_external_id is missing', () => {
    expect(
      toTokenEventFromLifecycle({
        ...base,
        card_id: undefined,
        status: 'ACTIVATED',
      }),
    ).toBeNull();
    expect(
      toTokenEventFromNotification({
        ...base,
        token_external_id: '',
        event_id: 'tokenization-completed-notification',
      }),
    ).toBeNull();
    expect(toTokenEventFromLifecycle(null)).toBeNull();
  });

  it('maps origin to APPLE_PAY, GOOGLE_PAY or OTHER', () => {
    expect(toWalletProvider('APPLE_PAY')).toBe('APPLE_PAY');
    expect(toWalletProvider('google_pay')).toBe('GOOGLE_PAY');
    expect(toWalletProvider('SAMSUNG_PAY')).toBe('OTHER');
    expect(toWalletProvider(undefined)).toBe('OTHER');
  });
});
