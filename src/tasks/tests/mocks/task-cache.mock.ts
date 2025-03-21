import { BaseTaskCacheHandler } from '../../interfaces/cache-handler.base.service';

export class MockTaskCacheHandler extends BaseTaskCacheHandler {
  public get = jest.fn();
  public set = jest.fn();
  public delete = jest.fn();
}
