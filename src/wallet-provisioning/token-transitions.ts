import {
  TokenEvent,
  WalletProvisioningStatus,
} from './abstract/wallet-provisioning.types';

// Still waiting for the wallet flow to finish: completion and abandonment only apply on these.
export const PENDING_STATUSES: ReadonlySet<WalletProvisioningStatus> = new Set([
  'REQUESTED',
  'OTP_PENDING',
  'OTP_SENT',
]);

// Once a token is provisioned, late OTP lifecycle events must not move it back.
export const OTP_STATUSES: ReadonlySet<WalletProvisioningStatus> = new Set([
  'OTP_PENDING',
  'OTP_SENT',
]);

// A user can finish adding the card after leaving the flow once.
export const COMPLETABLE_STATUSES: ReadonlySet<WalletProvisioningStatus> =
  new Set([...PENDING_STATUSES, 'ABANDONED']);

export const PROVISIONED_STATUSES: ReadonlySet<WalletProvisioningStatus> =
  new Set(['ACTIVATED', 'SUSPENDED', 'DISABLED', 'INACTIVE']);

// Tokens that put the card in the wallet; a suspended one comes back on unblock.
export const IN_WALLET_STATUSES: readonly WalletProvisioningStatus[] = [
  'ACTIVATED',
  'SUSPENDED',
];

export function nextStatus(
  current: WalletProvisioningStatus,
  event: TokenEvent,
): WalletProvisioningStatus {
  if (event.kind === 'LIFECYCLE') {
    // A deleted token never comes back (MDES/VTS issue a new token id), so a late event cannot
    // revive it.
    if (!event.status || current === 'DISABLED') return current;
    const isLateOtp =
      OTP_STATUSES.has(event.status) && PROVISIONED_STATUSES.has(current);
    return isLateOtp ? current : event.status;
  }
  if (event.kind === 'COMPLETED') {
    return COMPLETABLE_STATUSES.has(current) ? 'ACTIVATED' : current;
  }
  return PENDING_STATUSES.has(current) ? 'ABANDONED' : current;
}

// An applied lifecycle event carries its own reason (or clears an old one); anything else keeps
// the row's reason.
export function nextStatusReason(
  currentReason: string | null,
  event: TokenEvent,
  status: WalletProvisioningStatus,
): string | null {
  const appliesLifecycle =
    event.kind === 'LIFECYCLE' && status === event.status;
  return appliesLifecycle ? (event.statusReason ?? null) : currentReason;
}
