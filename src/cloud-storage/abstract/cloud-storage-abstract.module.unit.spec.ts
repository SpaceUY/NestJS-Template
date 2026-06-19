import { CloudStorageAbstractModule } from "./cloud-storage-abstract.module";
import { CloudStorageController } from "./cloud-storage.controller";
import { CloudStorageService } from "./cloud-storage.service";
import { LoggerService } from "../../common/logger/abstract/logger.service";
import { CloudStorageUploadFile } from "./cloud-storage.interfaces";

class MockCloudStorageAdapter extends CloudStorageService {
  async uploadFile(
    _: CloudStorageUploadFile,
  ): Promise<{ url: string; id: string }> {
    return { url: 'https://example.com/file', id: 'file-id' };
  }

  async deleteFile(_: string): Promise<void> {
    return undefined;
  }

  async getFile(fileKey: string): Promise<{ url: string; id: string }> {
    return { url: `https://example.com/${fileKey}`, id: fileKey };
  }
}

describe('CloudStorageAbstractModule', () => {
  it('should create an adapter instance via factory in forRoot', () => {
    const moduleRef = CloudStorageAbstractModule.forRoot({
      adapter: MockCloudStorageAdapter,
      isGlobal: true,
    });

    const provider = (
      moduleRef.providers as Array<{ provide: unknown; useFactory: (...args: unknown[]) => CloudStorageService; inject: unknown[] }>
    ).find((p) => p.provide === CloudStorageService);

    const instance = provider?.useFactory(undefined);

    expect(moduleRef.module).toBe(CloudStorageAbstractModule);
    expect(moduleRef.global).toBe(true);
    expect(instance).toBeInstanceOf(MockCloudStorageAdapter);
    expect(provider?.inject).toEqual([{ token: LoggerService, optional: true }]);
    expect(moduleRef.exports).toContain(CloudStorageService);
    expect(moduleRef.controllers).toEqual([]);
  });

  it('should call setLogger when a logger is provided in forRoot', () => {
    const moduleRef = CloudStorageAbstractModule.forRoot({
      adapter: MockCloudStorageAdapter,
    });

    const provider = (
      moduleRef.providers as Array<{ provide: unknown; useFactory: (...args: unknown[]) => CloudStorageService }>
    ).find((p) => p.provide === CloudStorageService);

    const mockLogger = { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), withTelemetry: jest.fn() } as unknown as LoggerService;
    const instance = provider?.useFactory(mockLogger) as MockCloudStorageAdapter;

    expect((instance as any).logger).toBe(mockLogger);
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

    // First arg is the optional logger (undefined here), second is the user dependency
    const resolved = await provider?.useFactory(undefined, dependencyValue);

    expect(moduleRef.global).toBe(true);
    expect(moduleRef.imports).toEqual([]);
    expect(provider?.inject).toEqual([{ token: LoggerService, optional: true }, dependencyToken]);
    expect(resolved).toBe(storageInstance);
    expect(moduleRef.exports).toContain(CloudStorageService);
    expect(moduleRef.controllers).toEqual([CloudStorageController]);
  });
});
