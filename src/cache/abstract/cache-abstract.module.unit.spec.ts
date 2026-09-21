import { DynamicModule, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CacheAbstractModule } from './cache-abstract.module';
import { CacheService } from './cache.service';
import { CACHE_ADAPTER_CLIENT, CACHE_LOGGER } from './cache.tokens';
import { CacheKeysExtension } from './extensions/cache-keys.extension';
import { CacheListExtension } from './extensions/cache-list.extension';
import { MockCacheKeysExtension } from './mocks/cache-keys.extension.mock';
import { MockCacheListExtension } from './mocks/cache-list.extension.mock';
import { MockCacheService } from './mocks/cache.service.mock';

const CLIENT = { ping: jest.fn() };
const LOGGER = { debug: jest.fn() };

/**
 * `MockCacheService` exposes `client` and `logger` as `null`, which cannot tell
 * the two token factories apart. This one hands each a distinct object.
 */
class StubCacheAdapter extends CacheService {
  readonly client = CLIENT;
  readonly logger = LOGGER;
  get = jest.fn().mockResolvedValue(null);
  set = jest.fn().mockResolvedValue(undefined);
  del = jest.fn().mockResolvedValue(undefined);
  clear = jest.fn().mockResolvedValue(undefined);
}

@Module({
  providers: [{ provide: 'REDIS_CONFIG', useValue: { host: 'localhost' } }],
  exports: ['REDIS_CONFIG'],
})
class ConfigStubModule {}

type ProviderShape = {
  provide: unknown;
  useClass?: unknown;
  inject?: unknown[];
  useFactory?: (...args: unknown[]) => unknown;
};

const shapes = (moduleRef: DynamicModule): ProviderShape[] =>
  (moduleRef.providers ?? []) as ProviderShape[];

const providerFor = (
  moduleRef: DynamicModule,
  token: unknown,
): ProviderShape | undefined =>
  shapes(moduleRef).find((p) => p.provide === token);

const tokens = (moduleRef: DynamicModule): unknown[] =>
  shapes(moduleRef).map((p) => p.provide);

describe('CacheAbstractModule', () => {
  describe('forRoot', () => {
    it('binds the adapter class to CacheService and exports only that', () => {
      const moduleRef = CacheAbstractModule.forRoot({
        adapter: MockCacheService,
      });

      expect(moduleRef.module).toBe(CacheAbstractModule);
      expect(moduleRef.global).toBe(false);
      expect(providerFor(moduleRef, CacheService)?.useClass).toBe(
        MockCacheService,
      );
      expect(moduleRef.exports).toEqual([CacheService]);
    });

    // Rule 3 of `src/cache/CLAUDE.md`: omit an extension key and the provider
    // is never created — including the raw-client and logger plumbing the
    // extensions need, which is what couples a consumer to ioredis.
    it('creates no extension plumbing when no extension is asked for', () => {
      const moduleRef = CacheAbstractModule.forRoot({
        adapter: MockCacheService,
      });

      expect(tokens(moduleRef)).toEqual([CacheService]);
    });

    it('sets isGlobal when specified', () => {
      expect(
        CacheAbstractModule.forRoot({
          adapter: MockCacheService,
          isGlobal: true,
        }).global,
      ).toBe(true);
    });

    it('wires only the extension it was given', () => {
      const moduleRef = CacheAbstractModule.forRoot({
        adapter: MockCacheService,
        extensions: { list: MockCacheListExtension },
      });

      expect(providerFor(moduleRef, CacheListExtension)?.useClass).toBe(
        MockCacheListExtension,
      );
      expect(providerFor(moduleRef, CacheKeysExtension)).toBeUndefined();
      expect(moduleRef.exports).toEqual([CacheService, CacheListExtension]);
    });

    it('wires both extensions and exports each of them', () => {
      const moduleRef = CacheAbstractModule.forRoot({
        adapter: MockCacheService,
        extensions: {
          list: MockCacheListExtension,
          keys: MockCacheKeysExtension,
        },
      });

      expect(providerFor(moduleRef, CacheKeysExtension)?.useClass).toBe(
        MockCacheKeysExtension,
      );
      expect(moduleRef.exports).toEqual([
        CacheService,
        CacheListExtension,
        CacheKeysExtension,
      ]);
    });

    // The extensions reach the driver through these two tokens. They are
    // read off the resolved adapter, never off a second connection.
    it('feeds the raw client and logger tokens from the adapter instance', () => {
      const moduleRef = CacheAbstractModule.forRoot({
        adapter: StubCacheAdapter,
        extensions: { keys: MockCacheKeysExtension },
      });

      const adapter = new StubCacheAdapter();
      const client = providerFor(moduleRef, CACHE_ADAPTER_CLIENT);
      const logger = providerFor(moduleRef, CACHE_LOGGER);

      expect(client?.inject).toEqual([CacheService]);
      expect(client?.useFactory?.(adapter)).toBe(CLIENT);
      expect(logger?.inject).toEqual([CacheService]);
      expect(logger?.useFactory?.(adapter)).toBe(LOGGER);
    });

    // They are plumbing for the extensions, not public surface: a consumer
    // that wants the raw ioredis client has to ask for it deliberately.
    it('keeps the raw client and logger tokens out of the exports', () => {
      const moduleRef = CacheAbstractModule.forRoot({
        adapter: MockCacheService,
        extensions: { list: MockCacheListExtension },
      });

      expect(moduleRef.exports).not.toContain(CACHE_ADAPTER_CLIENT);
      expect(moduleRef.exports).not.toContain(CACHE_LOGGER);
    });
  });

  describe('forRootAsync', () => {
    it('provides the service from the caller factory and its injected tokens', async () => {
      const adapter = new MockCacheService();
      const seen: unknown[] = [];

      const moduleRef = CacheAbstractModule.forRootAsync({
        inject: ['REDIS_CONFIG'],
        useFactory: (config: unknown) => {
          seen.push(config);
          return adapter;
        },
      });

      const provider = providerFor(moduleRef, CacheService);

      expect(provider?.inject).toEqual(['REDIS_CONFIG']);
      expect(await provider?.useFactory?.({ host: 'localhost' })).toBe(adapter);
      expect(seen).toEqual([{ host: 'localhost' }]);
    });

    it('defaults imports and inject to empty arrays when omitted', () => {
      const moduleRef = CacheAbstractModule.forRootAsync({
        useFactory: () => new MockCacheService(),
      });

      expect(moduleRef.imports).toEqual([]);
      expect(providerFor(moduleRef, CacheService)?.inject).toEqual([]);
      expect(moduleRef.global).toBe(false);
      expect(moduleRef.exports).toEqual([CacheService]);
    });

    it('carries the caller imports through untouched', () => {
      class SomeConfigModule {}

      expect(
        CacheAbstractModule.forRootAsync({
          imports: [SomeConfigModule],
          useFactory: () => new MockCacheService(),
        }).imports,
      ).toEqual([SomeConfigModule]);
    });

    it('sets isGlobal when specified', () => {
      expect(
        CacheAbstractModule.forRootAsync({
          isGlobal: true,
          useFactory: () => new MockCacheService(),
        }).global,
      ).toBe(true);
    });

    it('awaits an async factory', async () => {
      const moduleRef = CacheAbstractModule.forRootAsync({
        useFactory: async () => {
          await Promise.resolve();
          return new MockCacheService();
        },
      });

      expect(
        await providerFor(moduleRef, CacheService)?.useFactory?.(),
      ).toBeInstanceOf(MockCacheService);
    });

    it('creates no extension plumbing when no extension is asked for', () => {
      const moduleRef = CacheAbstractModule.forRootAsync({
        useFactory: () => new MockCacheService(),
      });

      expect(tokens(moduleRef)).toEqual([CacheService]);
    });

    it('wires the extensions the same way the synchronous path does', () => {
      const moduleRef = CacheAbstractModule.forRootAsync({
        useFactory: () => new StubCacheAdapter(),
        extensions: {
          list: MockCacheListExtension,
          keys: MockCacheKeysExtension,
        },
      });

      const adapter = new StubCacheAdapter();

      expect(providerFor(moduleRef, CacheListExtension)?.useClass).toBe(
        MockCacheListExtension,
      );
      expect(providerFor(moduleRef, CacheKeysExtension)?.useClass).toBe(
        MockCacheKeysExtension,
      );
      expect(
        providerFor(moduleRef, CACHE_ADAPTER_CLIENT)?.useFactory?.(adapter),
      ).toBe(CLIENT);
      expect(providerFor(moduleRef, CACHE_LOGGER)?.useFactory?.(adapter)).toBe(
        LOGGER,
      );
      expect(moduleRef.exports).toEqual([
        CacheService,
        CacheListExtension,
        CacheKeysExtension,
      ]);
    });
  });

  // The blocks above read the module definition. These prove the container
  // actually resolves what it describes — the whole point of `T1`, since a
  // consumer only ever names `CacheService`.
  describe('resolved through a real Nest container', () => {
    it('forRoot resolves the adapter under the service token', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [CacheAbstractModule.forRoot({ adapter: StubCacheAdapter })],
      }).compile();

      expect(moduleRef.get(CacheService)).toBeInstanceOf(StubCacheAdapter);

      await moduleRef.close();
    });

    it('forRoot resolves each extension and hands it the adapter client', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          CacheAbstractModule.forRoot({
            adapter: StubCacheAdapter,
            extensions: {
              list: MockCacheListExtension,
              keys: MockCacheKeysExtension,
            },
          }),
        ],
      }).compile();

      expect(moduleRef.get(CacheListExtension)).toBeInstanceOf(
        MockCacheListExtension,
      );
      expect(moduleRef.get(CacheKeysExtension)).toBeInstanceOf(
        MockCacheKeysExtension,
      );
      expect(moduleRef.get(CACHE_ADAPTER_CLIENT)).toBe(CLIENT);
      expect(moduleRef.get(CACHE_LOGGER)).toBe(LOGGER);

      await moduleRef.close();
    });

    it('forRootAsync resolves the service from an injected config token', async () => {
      const seen: unknown[] = [];

      const moduleRef = await Test.createTestingModule({
        imports: [
          CacheAbstractModule.forRootAsync({
            imports: [ConfigStubModule],
            inject: ['REDIS_CONFIG'],
            useFactory: (config: { host: string }) => {
              seen.push(config);
              return new StubCacheAdapter();
            },
          }),
        ],
      }).compile();

      expect(moduleRef.get(CacheService)).toBeInstanceOf(StubCacheAdapter);
      expect(seen).toEqual([{ host: 'localhost' }]);

      await moduleRef.close();
    });
  });
});
