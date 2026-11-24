import {
  TokenEvent,
  WalletProvider,
  WalletProvisioningStatus,
} from '../abstract/wallet-provisioning.types';
import {
  PomeloTokenLifecyclePayload,
  PomeloTokenNotificationPayload,
} from './pomelo.types';

// Pomelo's token statuses happen to share the module's names; unknown ones are ignored.
const LIFECYCLE_STATUSES: Record<string, WalletProvisioningStatus> = {
  OTP_PENDING: 'OTP_PENDING',
  OTP_SENT: 'OTP_SENT',
  ACTIVATED: 'ACTIVATED',
  SUSPENDED: 'SUSPENDED',
  DISABLED: 'DISABLED',
  INACTIVE: 'INACTIVE',
};

const NOTIFICATION_KINDS: Record<string, TokenEvent['kind']> = {
  'tokenization-completed-notification': 'COMPLETED',
  'tokenization-abandoned-notification': 'ABANDONED',
};

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export function toWalletProvider(origin: string | undefined): WalletProvider {
  const value = (origin ?? '').toUpperCase();
  if (value.includes('APPLE')) return 'APPLE_PAY';
  if (value.includes('GOOGLE')) return 'GOOGLE_PAY';
  return 'OTHER';
}

/** Null when the event cannot be applied: missing ids or a status we do not know. */
export function toTokenEventFromLifecycle(
  payload: PomeloTokenLifecyclePayload | null | undefined,
): TokenEvent | null {
  const status = payload?.status
    ? LIFECYCLE_STATUSES[payload.status]
    : undefined;
  if (!payload || !status) return null;
  if (!nonEmpty(payload.card_id) || !nonEmpty(payload.token_external_id)) {
    return null;
  }
  return {
    cardExternalId: payload.card_id,
    tokenExternalId: payload.token_external_id,
    wallet: toWalletProvider(payload.origin),
    kind: 'LIFECYCLE',
    status,
    ...(payload.token_status_reason && {
      statusReason: payload.token_status_reason,
    }),
  };
}

/** Pomelo sends both completion and abandonment to one URL, told apart by `event_id`. */
export function toTokenEventFromNotification(
  payload: PomeloTokenNotificationPayload | null | undefined,
): TokenEvent | null {
  const kind = payload?.event_id
    ? NOTIFICATION_KINDS[payload.event_id]
    : undefined;
  if (!payload || !kind) return null;
  if (!nonEmpty(payload.card_id) || !nonEmpty(payload.token_external_id)) {
    return null;
  }
  return {
    cardExternalId: payload.card_id,
    tokenExternalId: payload.token_external_id,
    wallet: toWalletProvider(payload.origin),
    kind,
  };
}
