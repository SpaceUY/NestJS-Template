import { ConfigProviderService } from './config-provider.service';
import { CONFIG_PROVIDER_ERRORS } from './config-provider-error-codes';
import { ConfigProviderError } from './config-provider.error';

export abstract class ReloadableConfigProviderService extends ConfigProviderService {
  private readonly _reloadListeners: Array<() => Promise<void>> = [];

  onReload(listener: () => Promise<void>): void {
    this._reloadListeners.push(listener);
  }

  /**
   * Notifies all reload listeners.
   * @returns {Promise<void>} - A promise that resolves when all reload listeners have completed.
   * @throws {ConfigProviderError} - If any reload listener fails.
   */
  protected async notifyReload(): Promise<void> {
    const results = await Promise.allSettled(
      this._reloadListeners.map((l) => l()),
    );
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason);
    if (errors.length > 0) {
      throw new ConfigProviderError(
        CONFIG_PROVIDER_ERRORS.RELOAD_FAILED,
        `${errors.length} reload listener(s) failed`,
        { errors: errors.map((e: Error) => e?.message ?? String(e)) },
      );
    }
  }

  abstract reload(): Promise<void>;
}
