import { Injectable } from '@nestjs/common';
import { BaseTaskCacheHandler } from '../interfaces/cache-handler.base.service';

@Injectable()
export class DefaultCacheHandlerService extends BaseTaskCacheHandler {
  private readonly _store: Map<string, string>;

  set(key: string, value: string, _?: number): Promise<void> {
    this._store.set(key, value);
    return Promise.resolve();
  }

  get(key: string): Promise<string | undefined> {
    return Promise.resolve(this._store.get(key));
  }

  delete(key: string): Promise<void> {
    this._store.delete(key);
    return Promise.resolve();
  }
}
