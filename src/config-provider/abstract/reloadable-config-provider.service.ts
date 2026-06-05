import { ConfigProviderService } from './config-provider.service';

export abstract class ReloadableConfigProviderService extends ConfigProviderService {
  private readonly _reloadListeners: Array<() => Promise<void>> = [];

  onReload(listener: () => Promise<void>): void {
    this._reloadListeners.push(listener);
  }

  protected async notifyReload(): Promise<void> {
    await Promise.all(this._reloadListeners.map((l) => l()));
  }

  abstract reload(): Promise<void>;
}
