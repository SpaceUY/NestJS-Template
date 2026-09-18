import { CloudStorageAbstractModule } from './cloud-storage-abstract.module';
import { CloudStorageController } from './cloud-storage.controller';
import { CloudStorageService } from './cloud-storage.service';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/observability/logger/nest-adapter/nest-logger.adapter';

class MockCloudStorageAdapter extends CloudStorageService {
  async uploadFile(): Promise<{ url: string; id: string }> {
    return { url: 'https://example.com/file', id: 'file-id' };
  }

  async deleteFile(): Promise<void> {
    return undefined;
  }

  async getFile(fileKey: string): Promise<{ url: string; id: string }> {
    return { url: `https://example.com/${fileKey}`, id: fileKey };
  }

  // `logger` is protected on CloudStorageService; this keeps the assertions
  // honest without casting the instance to `any`.
  exposeLogger(): LoggerService {
    return this.logger;
  }
}

/** Captures the context `setLogger` assigns, so tests can assert on it. */
class RecordingLogger extends LoggerService {
  context = '';
  setContext(context: string): void {
    this.context = context;
  }

  log(): void {}
  warn(): void {}
  error(): void {}
  debug(): void {}
}

describe('CloudStorageAbstractModule', () => {
  it('should bind the adapter class to CloudStorageService in forRoot', () => {
    const moduleRef = CloudStorageAbstractModule.forRoot({
      adapter: MockCloudStorageAdapter,
      isGlobal: true,
    });

    const provider = (
      moduleRef.providers as Array<{
        provide: unknown;
        inject: unknown[];
        useFactory: (logger?: LoggerService) => CloudStorageService;
      }>
    ).find((p) => p.provide === CloudStorageService);

    expect(moduleRef.module).toBe(CloudStorageAbstractModule);
    expect(moduleRef.global).toBe(true);
    expect(provider?.inject).toEqual([
      { token: LoggerService, optional: true },
    ]);
    expect(provider?.useFactory()).toBeInstanceOf(MockCloudStorageAdapter);
    expect(moduleRef.exports).toContain(CloudStorageService);
    expect(moduleRef.controllers).toEqual([]);
  });

  it('should hand the injected logger to the adapter, re-tagged with its class name, in forRoot', () => {
    const moduleRef = CloudStorageAbstractModule.forRoot({
      adapter: MockCloudStorageAdapter,
    });

    const provider = (
      moduleRef.providers as Array<{
        provide: unknown;
        useFactory: (logger?: LoggerService) => CloudStorageService;
      }>
    ).find((p) => p.provide === CloudStorageService);

    const injected = new RecordingLogger();
    const instance = provider?.useFactory(injected) as MockCloudStorageAdapter;

    expect(instance.exposeLogger()).toBe(injected);
    expect(injected.context).toBe('MockCloudStorageAdapter');
  });

  it('should fall back to the adapter default logger when none is available in forRoot', () => {
    const moduleRef = CloudStorageAbstractModule.forRoot({
      adapter: MockCloudStorageAdapter,
    });

    const provider = (
      moduleRef.providers as Array<{
        provide: unknown;
        useFactory: (logger?: LoggerService) => CloudStorageService;
      }>
    ).find((p) => p.provide === CloudStorageService);

    const instance = provider?.useFactory(undefined) as MockCloudStorageAdapter;

    expect(instance.exposeLogger()).toBeInstanceOf(NestLoggerAdapter);
  });

  it('should register CloudStorageController when useDefaultController is true in forRoot', () => {
    const moduleRef = CloudStorageAbstractModule.forRoot({
      adapter: MockCloudStorageAdapter,
      useDefaultController: true,
    });

    expect(moduleRef.controllers).toEqual([CloudStorageController]);
  });

  it('should bind a factory-returned instance to CloudStorageService in forRootAsync', async () => {
    const storageInstance = new MockCloudStorageAdapter();
    const dependencyToken = 'TEST_DEPENDENCY';
    const dependencyValue = 'dependency-value';

    const moduleRef = CloudStorageAbstractModule.forRootAsync({
      imports: [],
      inject: [dependencyToken],
      useFactory: async (value: string) => {
        expect(value).toBe(dependencyValue);
        return storageInstance;
      },
      isGlobal: true,
      useDefaultController: true,
    });

    const provider = (
      moduleRef.providers as Array<{
        provide: unknown;
        inject: unknown[];
        useFactory: (
          ...args: unknown[]
        ) => Promise<CloudStorageService> | CloudStorageService;
      }>
    ).find((p) => p.provide === CloudStorageService);

    // The module prepends the optional LoggerService to both `inject` and the
    // factory's parameter list, so the user factory's own args shift by one.
    const injected = new RecordingLogger();
    const resolved = await provider?.useFactory(injected, dependencyValue);

    expect(moduleRef.global).toBe(true);
    expect(moduleRef.imports).toEqual([]);
    expect(provider?.inject).toEqual([
      { token: LoggerService, optional: true },
      dependencyToken,
    ]);
    expect(resolved).toBe(storageInstance);
    expect(storageInstance.exposeLogger()).toBe(injected);
    expect(injected.context).toBe('MockCloudStorageAdapter');
    expect(moduleRef.exports).toContain(CloudStorageService);
    expect(moduleRef.controllers).toEqual([CloudStorageController]);
  });
});
