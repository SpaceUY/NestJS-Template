import { DynamicModule, Module, Provider } from '@nestjs/common';
import { reloadableSourceToken } from './config-provider-tokens';
import { CONFIG_PROVIDER_ERRORS } from './config-provider-error-codes';
import {
  ConfigProviderModuleAsyncOptions,
  ConfigProviderModuleOptions,
  ConfigScopeDefinition,
  ConfigScopeFieldMapping,
} from './config-provider.interfaces';
import { ConfigProviderService } from './config-provider.service';
import { ReloadableConfigProviderService } from './reloadable-config-provider.service';

function sourceToken(name: string): string {
  return `CONFIG_PROVIDER_SOURCE_${name.toUpperCase()}`;
}

async function resolveScope(
  scope: ConfigScopeDefinition<any>,
  sourceMap: Record<string, ConfigProviderService>,
): Promise<Record<string, unknown>> {
  const raw: Record<string, unknown> = {};
  for (const [field, mapping] of Object.entries(scope.fields) as [string, ConfigScopeFieldMapping][]) {
    raw[field] = await sourceMap[mapping.source].get(mapping.key);
  }

  if (!scope.schema) return raw;

  const { error, value } = scope.schema.validate(raw, {
    abortEarly: false,
    allowUnknown: false,
  });

  if (error) {
    throw new Error(
      `[${CONFIG_PROVIDER_ERRORS.SCOPE_VALIDATION_FAILED}] Scope "${scope.name}": ${error.message}`,
    );
  }

  return value;
}

function buildScopeProviders(
  scopes: ConfigScopeDefinition<any>[],
  registeredSourceNames: string[],
): Provider[] {
  const keys = scopes.map((s) => s.KEY);
  const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (duplicates.length > 0) {
    throw new Error(
      `[${CONFIG_PROVIDER_ERRORS.DUPLICATE_SCOPE_KEY}] Duplicate scope keys: ${[...new Set(duplicates)].join(', ')}`,
    );
  }

  return scopes.map((scope) => {
    const usedSources = [
      ...new Set(
        Object.values(scope.fields).map(
          (f: ConfigScopeFieldMapping) => f.source,
        ),
      ),
    ];

    for (const source of usedSources) {
      if (!registeredSourceNames.includes(source)) {
        throw new Error(
          `[${CONFIG_PROVIDER_ERRORS.UNKNOWN_SOURCE}] Scope "${scope.name}" references unknown source "${source}". Registered: ${registeredSourceNames.join(', ')}`,
        );
      }
    }

    return {
      provide: scope.KEY,
      useFactory: async (...adapters: ConfigProviderService[]) => {
        // inject order mirrors usedSources order, so adapters[i] === source usedSources[i].
        const sourceMap: Record<string, ConfigProviderService> = {};
        usedSources.forEach((name, i) => {
          sourceMap[name] = adapters[i];
        });

        const initialValue = await resolveScope(scope, sourceMap);

        // Static scope: resolved once at startup; plain object snapshot injected everywhere.
        if (!scope.live) return initialValue;

        // Live scope: wrap in a mutable ref so onReload listeners can swap the value in place.
        // Returning ref directly wouldn't work — consumers would hold a stale object reference.
        const ref = { current: initialValue };

        for (const adapter of adapters) {
          if (adapter instanceof ReloadableConfigProviderService) {
            adapter.onReload(async () => {
              ref.current = await resolveScope(scope, sourceMap);
            });
          }
        }

        // Proxy forwards all reads to ref.current so consumers always see the latest value
        // without needing to be re-injected.
        return new Proxy({} as any, {
          get: (_, key: string | symbol) => {
            if (typeof key === 'symbol') return undefined;
            return ref.current[key as string];
          },
          has: (_, key: string | symbol) => {
            if (typeof key === 'symbol') return false;
            return key in (ref.current as object);
          },
          ownKeys: () => Object.keys(ref.current),
          // Required for Object.keys() and spread ({ ...conf }) to enumerate proxy keys correctly.
          getOwnPropertyDescriptor: (_, key) => ({
            value: ref.current[key as string],
            writable: false,
            enumerable: true,
            configurable: true,
          }),
        });
      },
      inject: usedSources.map(sourceToken),
    };
  });
}

function buildReloadableProviders(sourceNames: string[]): Provider[] {
  return sourceNames.map((name) => ({
    provide: reloadableSourceToken(name),
    useFactory: (adapter: ConfigProviderService): ReloadableConfigProviderService | null =>
      adapter instanceof ReloadableConfigProviderService ? adapter : null,
    inject: [sourceToken(name)],
  }));
}

@Module({})
export class ConfigProviderAbstractModule {
  static forRoot(options: ConfigProviderModuleOptions): DynamicModule {
    const { isGlobal = false, sources, scopes = [] } = options;

    const sourceNames = Object.keys(sources);

    const sourceProviders: Provider[] = Object.entries(sources).map(
      ([name, src]) => {
        if (src.useValue !== undefined) {
          return { provide: sourceToken(name), useValue: src.useValue };
        }
        return { provide: sourceToken(name), useClass: src.useClass! };
      },
    );

    const scopeProviders = buildScopeProviders(scopes, sourceNames);
    const reloadableProviders = buildReloadableProviders(sourceNames);
    const scopeExports = scopes.map((s) => s.KEY);
    const reloadableExports = sourceNames.map(reloadableSourceToken);

    return {
      module: ConfigProviderAbstractModule,
      global: isGlobal,
      providers: [...sourceProviders, ...scopeProviders, ...reloadableProviders],
      exports: [...scopeExports, ...reloadableExports],
    };
  }

  static forRootAsync(options: ConfigProviderModuleAsyncOptions): DynamicModule {
    const { isGlobal = false, sources, scopes = [] } = options;

    const sourceNames = Object.keys(sources);

    const allImports: any[] = [];
    for (const src of Object.values(sources)) {
      if (src.imports) allImports.push(...src.imports);
    }

    const sourceProviders: Provider[] = Object.entries(sources).map(
      ([name, src]) => ({
        provide: sourceToken(name),
        useFactory: src.useFactory,
        inject: src.inject || [],
      }),
    );

    const scopeProviders = buildScopeProviders(scopes, sourceNames);
    const reloadableProviders = buildReloadableProviders(sourceNames);
    const scopeExports = scopes.map((s) => s.KEY);
    const reloadableExports = sourceNames.map(reloadableSourceToken);

    return {
      module: ConfigProviderAbstractModule,
      global: isGlobal,
      imports: allImports,
      providers: [...sourceProviders, ...scopeProviders, ...reloadableProviders],
      exports: [...scopeExports, ...reloadableExports],
    };
  }
}
