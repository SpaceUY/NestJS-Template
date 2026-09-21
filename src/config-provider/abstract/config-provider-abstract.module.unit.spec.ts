import { ConfigProviderAbstractModule } from './config-provider-abstract.module';
import { CONFIG_PROVIDER_ERRORS } from './config-provider.error';
import { ConfigScopeDefinition } from './config-provider.interfaces';
import { ConfigProviderService } from './config-provider.service';
import { ReloadableConfigProviderService } from './reloadable-config-provider.service';
import { defineConfigScope } from './define-config-scope.util';
import { SOURCES } from './config-source.util';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/observability/logger/nest-adapter/nest-logger.adapter';

/** Zero-arg adapter, the only shape `useClass` accepts. */
class ZeroArgAdapter extends ConfigProviderService {
  async get(): Promise<string | undefined> {
    return undefined;
  }

  async getOrThrow(): Promise<string> {
    throw new Error('not found');
  }

  // `logger` is protected on ConfigProviderService.
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

class MockEnvAdapter extends ConfigProviderService {
  constructor(private readonly store: Record<string, string>) {
    super();
  }

  async get(key: string): Promise<string | undefined> {
    return this.store[key];
  }

  async getOrThrow(key: string): Promise<string> {
    const value = this.store[key];
    if (value === undefined) throw new Error(`Key "${key}" not found`);
    return value;
  }
}

class MockReloadableAdapter extends ReloadableConfigProviderService {
  constructor(private store: Record<string, string>) {
    super();
  }

  async get(key: string): Promise<string | undefined> {
    return this.store[key];
  }

  async getOrThrow(key: string): Promise<string> {
    const value = this.store[key];
    if (value === undefined) throw new Error(`Key "${key}" not found`);
    return value;
  }

  async reload(): Promise<void> {
    await this.notifyReload();
  }

  update(store: Record<string, string>): void {
    this.store = store;
  }
}

type TestScope = { secret: string; timeout: string };

const testScope = defineConfigScope<TestScope>(
  'test',
  {
    secret: { source: SOURCES.AWS_SECRETS_MANAGER, key: 'APP_SECRET' },
    timeout: { source: SOURCES.ENVIRONMENT, key: 'TIMEOUT' },
  },
  (raw) => {
    if (!raw.secret) throw new Error('"secret" is required');
    return {
      secret: raw.secret as string,
      timeout: (raw.timeout as string) ?? '30s',
    };
  },
);

/** The shape of a provider entry as these tests read it back off a DynamicModule. */
type ProviderEntry = {
  provide?: unknown;
  inject?: unknown[];
  useFactory?: (...args: unknown[]) => unknown;
  useValue?: unknown;
};

const providersOf = (moduleRef: { providers?: unknown[] }): ProviderEntry[] =>
  (moduleRef.providers ?? []) as ProviderEntry[];

describe('ConfigProviderAbstractModule', () => {
  describe('forRoot', () => {
    it('should register sources with useValue and export scope keys', () => {
      const envAdapter = new MockEnvAdapter({ TIMEOUT: '10s' });
      const smAdapter = new MockReloadableAdapter({ APP_SECRET: 'abc' });

      const moduleRef = ConfigProviderAbstractModule.forRoot({
        isGlobal: true,
        sources: {
          env: { useValue: envAdapter },
          sm: { useValue: smAdapter },
        },
        scopes: [testScope],
      });

      expect(moduleRef.module).toBe(ConfigProviderAbstractModule);
      expect(moduleRef.global).toBe(true);
      expect(moduleRef.exports).toContain(testScope.KEY);
    });

    it('should throw at registration time when a scope references an unknown source', () => {
      expect(() =>
        ConfigProviderAbstractModule.forRoot({
          sources: {
            env: { useValue: new MockEnvAdapter({}) },
          },
          scopes: [testScope], // testScope uses 'sm' which is not registered
        }),
      ).toThrow(
        expect.objectContaining({
          code: CONFIG_PROVIDER_ERRORS.UNKNOWN_SOURCE,
        }),
      );
    });
  });

  describe('forRootAsync', () => {
    it('should register sources via factory and export scope keys', () => {
      const moduleRef = ConfigProviderAbstractModule.forRootAsync({
        isGlobal: true,
        sources: {
          env: { useFactory: () => new MockEnvAdapter({}) },
          sm: { useFactory: () => new MockReloadableAdapter({}) },
        },
        scopes: [testScope],
      });

      expect(moduleRef.global).toBe(true);
      expect(moduleRef.exports).toContain(testScope.KEY);
    });

    it('should collect imports from all source registrations', () => {
      const SomeModule = class {};
      const OtherModule = class {};

      const moduleRef = ConfigProviderAbstractModule.forRootAsync({
        sources: {
          env: {
            imports: [SomeModule],
            useFactory: () => new MockEnvAdapter({}),
          },
          sm: {
            imports: [OtherModule],
            useFactory: () => new MockReloadableAdapter({}),
          },
        },
      });

      expect(moduleRef.imports).toContain(SomeModule);
      expect(moduleRef.imports).toContain(OtherModule);
    });
  });

  describe('scope provider factory', () => {
    async function resolveScopeFactory(
      scope: ConfigScopeDefinition<Record<string, unknown>>,
      adapters: Record<string, ConfigProviderService>,
    ): Promise<unknown> {
      const moduleRef = ConfigProviderAbstractModule.forRoot({
        sources: Object.fromEntries(
          Object.entries(adapters).map(([name, adapter]) => [
            name,
            { useValue: adapter },
          ]),
        ),
        scopes: [scope],
      });

      const provider = providersOf(moduleRef).find(
        (p) => p.provide === scope.KEY,
      );

      const sources = scope.fields
        ? [
            ...new Set(
              Object.values(scope.fields).map(
                (field: { source: string }) => field.source,
              ),
            ),
          ].map((name) => adapters[name])
        : [];

      return provider?.useFactory?.(...sources);
    }

    it('should map fields from the correct source adapters', async () => {
      const envAdapter = new MockEnvAdapter({ TIMEOUT: '60s' });
      const smAdapter = new MockReloadableAdapter({
        APP_SECRET: 'super-secret',
      });

      const result = await resolveScopeFactory(testScope, {
        env: envAdapter,
        sm: smAdapter,
      });

      expect(result).toMatchObject({ secret: 'super-secret', timeout: '60s' });
    });

    it('should apply defaults for missing optional fields', async () => {
      const envAdapter = new MockEnvAdapter({});
      const smAdapter = new MockReloadableAdapter({
        APP_SECRET: 'super-secret',
      });

      const result = await resolveScopeFactory(testScope, {
        env: envAdapter,
        sm: smAdapter,
      });

      expect(result).toMatchObject({ secret: 'super-secret', timeout: '30s' });
    });

    it('should throw on validation failure', async () => {
      const envAdapter = new MockEnvAdapter({});
      const smAdapter = new MockReloadableAdapter({}); // missing required APP_SECRET

      await expect(
        resolveScopeFactory(testScope, { env: envAdapter, sm: smAdapter }),
      ).rejects.toMatchObject({
        code: CONFIG_PROVIDER_ERRORS.SCOPE_VALIDATION_FAILED,
      });
    });

    it('should return raw values when no validate callback is provided', async () => {
      const noSchemaScope = defineConfigScope('noop', {
        token: { source: 'env', key: 'TOKEN' },
      });

      const envAdapter = new MockEnvAdapter({ TOKEN: 'raw-value' });
      const result = await resolveScopeFactory(noSchemaScope, {
        env: envAdapter,
      });

      expect(result).toEqual({ token: 'raw-value' });
    });
  });

  describe('live scopes', () => {
    type LiveScope = { secret: string };

    const liveScope = defineConfigScope<LiveScope>(
      'live',
      { secret: { source: 'sm', key: 'APP_SECRET' } },
      (raw) => {
        if (!raw.secret) throw new Error('"secret" is required');
        return { secret: raw.secret as string };
      },
      { live: true },
    );

    async function resolveLiveScope(
      adapter: MockReloadableAdapter,
    ): Promise<LiveScope> {
      const moduleRef = ConfigProviderAbstractModule.forRoot({
        sources: { sm: { useValue: adapter } },
        scopes: [liveScope],
      });

      const provider = providersOf(moduleRef).find(
        (p) => p.provide === liveScope.KEY,
      );

      return provider?.useFactory?.(adapter) as LiveScope;
    }

    it('should return a proxy that reflects the initial value', async () => {
      const adapter = new MockReloadableAdapter({ APP_SECRET: 'initial' });
      const conf = await resolveLiveScope(adapter);

      expect(conf.secret).toBe('initial');
    });

    it('should reflect updated values after reload without re-injecting', async () => {
      const adapter = new MockReloadableAdapter({ APP_SECRET: 'initial' });
      const conf = await resolveLiveScope(adapter);

      adapter.update({ APP_SECRET: 'updated' });
      await adapter.reload();

      expect(conf.secret).toBe('updated');
    });

    it('should support Object.keys and spread on the proxy', async () => {
      const adapter = new MockReloadableAdapter({ APP_SECRET: 'value' });
      const conf = await resolveLiveScope(adapter);

      expect(Object.keys(conf)).toEqual(['secret']);
      expect({ ...conf }).toEqual({ secret: 'value' });
    });

    it('should return true for `in` operator on valid fields', async () => {
      const adapter = new MockReloadableAdapter({ APP_SECRET: 'value' });
      const conf = await resolveLiveScope(adapter);

      expect('secret' in conf).toBe(true);
      expect('nonexistent' in conf).toBe(false);
    });
  });

  describe('duplicate scope keys', () => {
    it('should throw at registration when two scopes share the same name', () => {
      const dupeScope = defineConfigScope<TestScope>('test', {
        secret: { source: SOURCES.AWS_SECRETS_MANAGER, key: 'APP_SECRET' },
        timeout: { source: SOURCES.ENVIRONMENT, key: 'TIMEOUT' },
      });

      expect(() =>
        ConfigProviderAbstractModule.forRoot({
          sources: {
            [SOURCES.ENVIRONMENT]: { useValue: new MockEnvAdapter({}) },
            [SOURCES.AWS_SECRETS_MANAGER]: {
              useValue: new MockReloadableAdapter({}),
            },
          },
          scopes: [testScope, dupeScope],
        }),
      ).toThrow(
        expect.objectContaining({
          code: CONFIG_PROVIDER_ERRORS.DUPLICATE_SCOPE_KEY,
        }),
      );
    });
  });

  describe('logger wiring', () => {
    const sourceToken = 'CONFIG_PROVIDER_SOURCE_ENV';

    const findSource = (moduleRef: {
      providers?: unknown[];
    }): ProviderEntry | undefined =>
      providersOf(moduleRef).find((p) => p?.provide === sourceToken);

    it('hands the injected logger to a useClass source, re-tagged with its class name', () => {
      const moduleRef = ConfigProviderAbstractModule.forRoot({
        sources: { env: { useClass: ZeroArgAdapter } },
      });

      const provider = findSource(moduleRef);
      const injected = new RecordingLogger();
      const instance = provider?.useFactory!(injected) as ZeroArgAdapter;

      expect(provider?.inject).toEqual([
        { token: LoggerService, optional: true },
      ]);
      expect(instance.exposeLogger()).toBe(injected);
      expect(injected.context).toBe('ZeroArgAdapter');
    });

    it('leaves a useValue source untouched, since the instance belongs to the caller', () => {
      const caller = new ZeroArgAdapter();
      const before = caller.exposeLogger();

      const moduleRef = ConfigProviderAbstractModule.forRoot({
        sources: { env: { useValue: caller } },
      });

      const provider = findSource(moduleRef);

      expect(provider?.useValue).toBe(caller);
      expect(provider?.useFactory).toBeUndefined();
      expect(caller.exposeLogger()).toBe(before);
    });

    it('prepends the optional logger to a useFactory source inject list', async () => {
      const moduleRef = ConfigProviderAbstractModule.forRootAsync({
        sources: {
          env: {
            inject: ['TOKEN_A'],
            useFactory: (value: string) => {
              expect(value).toBe('value-a');
              return new ZeroArgAdapter();
            },
          },
        },
      });

      const provider = findSource(moduleRef);
      const injected = new RecordingLogger();
      const instance = (await provider?.useFactory!(
        injected,
        'value-a',
      )) as ZeroArgAdapter;

      expect(provider?.inject).toEqual([
        { token: LoggerService, optional: true },
        'TOKEN_A',
      ]);
      expect(instance.exposeLogger()).toBe(injected);
      expect(injected.context).toBe('ZeroArgAdapter');
    });

    it('falls back to the adapter default logger when LoggerService is unavailable', async () => {
      const moduleRef = ConfigProviderAbstractModule.forRootAsync({
        sources: { env: { useFactory: () => new ZeroArgAdapter() } },
      });

      const provider = findSource(moduleRef);
      const instance = (await provider?.useFactory!(
        undefined,
      )) as ZeroArgAdapter;

      expect(instance.exposeLogger()).toBeInstanceOf(NestLoggerAdapter);
    });
  });
});
