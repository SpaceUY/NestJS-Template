import { ConfigProviderService } from './config-provider.service';

export abstract class ReloadableConfigProviderService extends ConfigProviderService {
  private readonly _reloadListeners: Array<() => Promise<void>> = [];

  onReload(listener: () => Promise<void>): void {
    this._reloadListeners.push(listener);
  }

  protected async notifyReload(): Promise<void> {
    const results = await Promise.allSettled(this._reloadListeners.map((l) => l()));
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason);
    if (errors.length > 0) {
      throw new Error(
        `${errors.length} reload listener(s) failed:\n${errors.map((e: Error) => e?.message ?? String(e)).join('\n')}`,
      );
    }
  }

  abstract reload(): Promise<void>;
}
