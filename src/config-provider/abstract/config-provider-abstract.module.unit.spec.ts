import Joi = require('joi');
import { ConfigProviderAbstractModule } from './config-provider-abstract.module';
import { CONFIG_PROVIDER_ERRORS } from './config-provider-error-codes';
import { ConfigScopeDefinition } from './config-provider.interfaces';
import { ConfigProviderService } from './config-provider.service';
import { ReloadableConfigProviderService } from './reloadable-config-provider.service';
import { defineConfigScope } from './define-config-scope.util';

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
    secret: { source: 'sm', key: 'APP_SECRET' },
    timeout: { source: 'env', key: 'TIMEOUT' },
  },
  Joi.object<TestScope>({
    secret: Joi.string().required(),
    timeout: Joi.string().default('30s'),
  }),
);

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
      ).toThrow(CONFIG_PROVIDER_ERRORS.UNKNOWN_SOURCE);
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
          env: { imports: [SomeModule], useFactory: () => new MockEnvAdapter({}) },
          sm: { imports: [OtherModule], useFactory: () => new MockReloadableAdapter({}) },
        },
      });

      expect(moduleRef.imports).toContain(SomeModule);
      expect(moduleRef.imports).toContain(OtherModule);
    });
  });

  describe('scope provider factory', () => {
    async function resolveScopeFactory(
      scope: ConfigScopeDefinition<any>,
      adapters: Record<string, ConfigProviderService>,
    ): Promise<unknown> {
      const moduleRef = ConfigProviderAbstractModule.forRoot({
        sources: Object.fromEntries(
          Object.entries(adapters).map(([name, adapter]) => [name, { useValue: adapter }]),
        ),
        scopes: [scope],
      });

      const provider = (moduleRef.providers as any[]).find(
        (p) => p.provide === scope.KEY,
      );

      return provider.useFactory(
        ...scope.fields
          ? [...new Set(Object.values(scope.fields).map((f: any) => f.source))].map(
              (name) => adapters[name as string],
            )
          : [],
      );
    }

    it('should map fields from the correct source adapters', async () => {
      const envAdapter = new MockEnvAdapter({ TIMEOUT: '60s' });
      const smAdapter = new MockReloadableAdapter({ APP_SECRET: 'super-secret' });

      const result = await resolveScopeFactory(testScope, { env: envAdapter, sm: smAdapter });

      expect(result).toMatchObject({ secret: 'super-secret', timeout: '60s' });
    });

    it('should apply Joi defaults for missing optional fields', async () => {
      const envAdapter = new MockEnvAdapter({});
      const smAdapter = new MockReloadableAdapter({ APP_SECRET: 'super-secret' });

      const result = await resolveScopeFactory(testScope, { env: envAdapter, sm: smAdapter });

      expect(result).toMatchObject({ secret: 'super-secret', timeout: '30s' });
    });

    it('should throw on validation failure', async () => {
      const envAdapter = new MockEnvAdapter({});
      const smAdapter = new MockReloadableAdapter({}); // missing required APP_SECRET

      await expect(
        resolveScopeFactory(testScope, { env: envAdapter, sm: smAdapter }),
      ).rejects.toThrow(CONFIG_PROVIDER_ERRORS.SCOPE_VALIDATION_FAILED);
    });

    it('should return raw values when no schema is provided', async () => {
      const noSchemaScope = defineConfigScope('noop', {
        token: { source: 'env', key: 'TOKEN' },
      });

      const envAdapter = new MockEnvAdapter({ TOKEN: 'raw-value' });
      const result = await resolveScopeFactory(noSchemaScope, { env: envAdapter });

      expect(result).toEqual({ token: 'raw-value' });
    });
  });

  describe('live scopes', () => {
    type LiveScope = { secret: string };

    const liveScope = defineConfigScope<LiveScope>(
      'live',
      { secret: { source: 'sm', key: 'APP_SECRET' } },
      Joi.object<LiveScope>({ secret: Joi.string().required() }),
      { live: true },
    );

    async function resolveLiveScope(
      adapter: MockReloadableAdapter,
    ): Promise<LiveScope> {
      const moduleRef = ConfigProviderAbstractModule.forRoot({
        sources: { sm: { useValue: adapter } },
        scopes: [liveScope],
      });

      const provider = (moduleRef.providers as any[]).find(
        (p) => p.provide === liveScope.KEY,
      );

      return provider.useFactory(adapter);
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
  });
});
