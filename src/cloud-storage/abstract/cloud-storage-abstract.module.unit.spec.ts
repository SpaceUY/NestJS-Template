import { CloudStorageAbstractModule } from "@/modules/infrastructure/cloud-storage/abstract/cloud-storage-abstract.module";
import { CloudStorageController } from "@/modules/infrastructure/cloud-storage/abstract/cloud-storage.controller";
import {
  CloudStorageService,
  CloudStorageUploadFile,
} from "@/modules/infrastructure/cloud-storage/abstract/cloud-storage.service";

class MockCloudStorageAdapter extends CloudStorageService {
  async uploadFile(_: CloudStorageUploadFile): Promise<{ url: string; id: string }> {
    return { url: "https://example.com/file", id: "file-id" };
  }

  async deleteFile(_: string): Promise<void> {
    return Promise.resolve();
  }

  async getFile(fileKey: string): Promise<{ url: string; id: string }> {
    return { url: `https://example.com/${fileKey}`, id: fileKey };
  }
}

describe("CloudStorageAbstractModule", () => {
  it("should bind the adapter class to CloudStorageService in forRoot", () => {
    const moduleRef = CloudStorageAbstractModule.forRoot({
      adapter: MockCloudStorageAdapter,
      isGlobal: true,
    });

    const provider = (moduleRef.providers as Array<{ provide: unknown; useClass: unknown }>).find(
      p => p.provide === CloudStorageService,
    );

    expect(moduleRef.module).toBe(CloudStorageAbstractModule);
    expect(moduleRef.global).toBe(true);
    expect(provider?.useClass).toBe(MockCloudStorageAdapter);
    expect(moduleRef.exports).toContain(CloudStorageService);
    expect(moduleRef.controllers).toEqual([]);
  });

  it("should register CloudStorageController when useDefaultController is true in forRoot", () => {
    const moduleRef = CloudStorageAbstractModule.forRoot({
      adapter: MockCloudStorageAdapter,
      useDefaultController: true,
    });

    expect(moduleRef.controllers).toEqual([CloudStorageController]);
  });

  it("should bind a factory-returned instance to CloudStorageService in forRootAsync", async () => {
    const storageInstance = new MockCloudStorageAdapter();
    const dependencyToken = "TEST_DEPENDENCY";
    const dependencyValue = "dependency-value";

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

    const provider = (moduleRef.providers as Array<{
      provide: unknown;
      inject: unknown[];
      useFactory: (...args: unknown[]) => Promise<CloudStorageService> | CloudStorageService;
    }>).find(p => p.provide === CloudStorageService);

    const resolved = await provider?.useFactory(dependencyValue);

    expect(moduleRef.global).toBe(true);
    expect(moduleRef.imports).toEqual([]);
    expect(provider?.inject).toEqual([dependencyToken]);
    expect(resolved).toBe(storageInstance);
    expect(moduleRef.exports).toContain(CloudStorageService);
    expect(moduleRef.controllers).toEqual([CloudStorageController]);
  });
});
