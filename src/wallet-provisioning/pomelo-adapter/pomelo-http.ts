import {
  WALLET_PROVISIONING_ERRORS,
  WalletProvisioningError,
} from '../abstract/wallet-provisioning.error';

export type JsonResponse = { status: number; body: unknown };

/**
 * POSTs JSON to Pomelo with a hard timeout. Errors never carry the request, the response body or
 * the underlying message: they can echo nonces, certificates or hosts.
 */
export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<JsonResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const parsed: unknown = await response.json().catch(() => null);
    return { status: response.status, body: parsed };
  } catch {
    if (controller.signal.aborted) {
      throw new WalletProvisioningError(
        WALLET_PROVISIONING_ERRORS.PROVIDER_TIMEOUT,
        `Pomelo did not answer within ${timeoutMs} ms`,
      );
    }
    throw new WalletProvisioningError(
      WALLET_PROVISIONING_ERRORS.PROVIDER_REQUEST_FAILED,
      'Pomelo could not be reached',
    );
  } finally {
    clearTimeout(timer);
  }
}

export const isSuccess = (status: number): boolean =>
  status >= 200 && status < 300;
