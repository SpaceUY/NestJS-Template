import {
  DynamicModule,
  Module,
  ModuleMetadata,
  Provider,
} from '@nestjs/common';
import { reloadableSourceToken } from './config-provider-tokens';
import {
  ConfigProviderError,
  CONFIG_PROVIDER_ERRORS,
} from './config-provider.error';
import {
  ConfigProviderModuleAsyncOptions,
  ConfigProviderModuleOptions,
  ConfigScopeDefinition,
  ConfigScopeFieldMapping,
} from './config-provider.interfaces';
import { ConfigProviderService } from './config-provider.service';
import { ReloadableConfigProviderService } from './reloadable-config-provider.service';
import { LoggerService } from '../../common/logger/abstract/logger.service';

function sourceToken(name: string): string {
  return `CONFIG_PROVIDER_SOURCE_${name.toUpperCase()}`;
}

/**
 * Fetches every field declared in a scope from its respective source adapter,
 * then runs the result through the scope's validate callback (coercion + validation).
 * Returns the validated plain object that will be injected as the scope value.
 * @param {ConfigScopeDefinition<Record<string, unknown>>} scope - The scope to resolve.
 * @param {Record<string, ConfigProviderService>} sourceMap - The map of source adapters.
 * @returns {Promise<Record<string, unknown>>} - The resolved scope value.
 * @throws {ConfigProviderError} - If the scope validation fails.
 */
async function resolveScope(
  scope: ConfigScopeDefinition<Record<string, unknown>>,
  sourceMap: Record<string, ConfigProviderService>,
): Promise<Record<string, unknown>> {
  const raw: Record<string, unknown> = {};
  for (const [field, mapping] of Object.entries(scope.fields) as [
    string,
    ConfigScopeFieldMapping,
  ][]) {
    raw[field] = await sourceMap[mapping.source].get(mapping.key);
  }

  if (!scope.validate) return raw;

  try {
    return scope.validate(raw);
  } catch (error) {
    throw new ConfigProviderError(
      CONFIG_PROVIDER_ERRORS.SCOPE_VALIDATION_FAILED,
      `Scope "${scope.name}" failed validation`,
      { scope: scope.name, details: (error as Error).message },
    );
  }
}

/**
 * Returns the deduplicated source names referenced by a scope's fields.
 * @param {ConfigScopeDefinition<Record<string, unknown>>} scope - The scope to check.
 * @returns {string[]} - The deduplicated source names.
 */
function scopeSourceNames(
  scope: ConfigScopeDefinition<Record<string, unknown>>,
): string[] {
  return [
    ...new Set(
      Object.values(scope.fields).map((f: ConfigScopeFieldMapping) => f.source),
    ),
  ];
}

/**
 * Throws if any source referenced by the scope is not registered.
 * @param {ConfigScopeDefinition<Record<string, unknown>>} scope - The scope to check.
 * @param {string[]} usedSources - The sources used by the scope.
 * @param {string[]} registeredSourceNames - The names of the registered sources.
 * @throws {ConfigProviderError} - If the source is not registered.
 */
function assertSourcesRegistered(
  scope: ConfigScopeDefinition<Record<string, unknown>>,
  usedSources: string[],
  registeredSourceNames: string[],
): void {
  for (const source of usedSources) {
    if (!registeredSourceNames.includes(source)) {
      throw new ConfigProviderError(
        CONFIG_PROVIDER_ERRORS.UNKNOWN_SOURCE,
        `Scope "${scope.name}" references unknown source "${source}"`,
        { scope: scope.name, source, registered: registeredSourceNames },
      );
    }
  }
}

/**
 * Wraps a mutable ref in a Proxy so that consumers always read the latest
 * reloaded value without needing to be re-injected.
 * Object.keys() and spread ({ ...conf }) reflect the current ref state because
 * ownKeys + getOwnPropertyDescriptor are forwarded to ref.current.
 * @param {Record<string, unknown>} ref - The mutable reference.
 * @returns {Record<string, unknown>} - The live proxy.
 */
function buildLiveProxy(ref: {
  current: Record<string, unknown>;
}): Record<string, unknown> {
  return new Proxy(
    {},
    {
      get: (_, key: string | symbol) => {
        if (typeof key === 'symbol') return undefined;
        return ref.current[key];
      },
      has: (_, key: string | symbol) => {
        if (typeof key === 'symbol') return false;
        return key in (ref.current as object);
      },
      ownKeys: () => Object.keys(ref.current),
      getOwnPropertyDescriptor: (_, key) => ({
        value: ref.current[key as string],
        writable: false,
        enumerable: true,
        configurable: true,
      }),
    },
  );
}

/**
 * Builds the NestJS provider for a single scope. The factory injects the
 * relevant source adapters (in usedSources order), resolves the scope, and
 * returns either a plain object snapshot (static) or a live Proxy that
 * auto-updates when a reloadable adapter fires reload().
 */
function buildScopeProvider(
  scope: ConfigScopeDefinition<Record<string, unknown>>,
  usedSources: string[],
): Provider {
  return {
    provide: scope.KEY,
    // inject order mirrors usedSources order, so adapters[i] === source usedSources[i].
    useFactory: async (...adapters: ConfigProviderService[]) => {
      const sourceMap: Record<string, ConfigProviderService> = {};
      usedSources.forEach((name, i) => {
        sourceMap[name] = adapters[i];
      });

      const initialValue = await resolveScope(scope, sourceMap);

      if (!scope.live) return initialValue;

      const ref = { current: initialValue };

      for (const adapter of adapters) {
        if (adapter instanceof ReloadableConfigProviderService) {
          adapter.onReload(async () => {
            ref.current = await resolveScope(scope, sourceMap);
          });
        }
      }

      return buildLiveProxy(ref);
    },
    inject: usedSources.map(sourceToken),
  };
}

/**
 * Validates the full scope list for duplicate keys and unknown sources, then
 * delegates to buildScopeProvider for each scope. Throws at registration time
 * so misconfiguration surfaces immediately on app startup.
 */
function buildScopeProviders(
  scopes: ConfigScopeDefinition<Record<string, unknown>>[],
  registeredSourceNames: string[],
): Provider[] {
  const keys = scopes.map((s) => s.KEY);
  const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (duplicates.length > 0) {
    throw new ConfigProviderError(
      CONFIG_PROVIDER_ERRORS.DUPLICATE_SCOPE_KEY,
      'Duplicate scope keys detected',
      { keys: [...new Set(duplicates)] },
    );
  }

  return scopes.map((scope) => {
    const usedSources = scopeSourceNames(scope);
    assertSourcesRegistered(scope, usedSources, registeredSourceNames);
    return buildScopeProvider(scope, usedSources);
  });
}

/**
 * Builds one provider per registered source under the reloadableSourceToken(name)
 * injection token. Resolves to the adapter instance if it extends
 * ReloadableConfigProviderService, or null otherwise — letting callers
 * distinguish reloadable sources without knowing the concrete adapter type.
 * @param {string[]} sourceNames - The names of the registered sources.
 * @returns {Provider[]} - The built reloadable providers.
 * @throws {ConfigProviderError} - If the source name is not found.
 */
function buildReloadableProviders(sourceNames: string[]): Provider[] {
  return sourceNames.map((name) => ({
    provide: reloadableSourceToken(name),
    useFactory: (
      adapter: ConfigProviderService,
    ): ReloadableConfigProviderService | null =>
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
          return {
            provide: sourceToken(name),
            useFactory: (logger?: LoggerService) => {
              if (logger) src.useValue!.setLogger(logger);
              return src.useValue!;
            },
            inject: [{ token: LoggerService, optional: true }],
          };
        }
        return {
          provide: sourceToken(name),
          useFactory: (logger?: LoggerService) => {
            const instance = new src.useClass!();
            if (logger) instance.setLogger(logger);
            return instance;
          },
          inject: [{ token: LoggerService, optional: true }],
        };
      },
    );

    const scopeProviders = buildScopeProviders(scopes, sourceNames);
    const reloadableProviders = buildReloadableProviders(sourceNames);
    const scopeExports = scopes.map((s) => s.KEY);
    const reloadableExports = sourceNames.map(reloadableSourceToken);

    return {
      module: ConfigProviderAbstractModule,
      global: isGlobal,
      providers: [
        ...sourceProviders,
        ...scopeProviders,
        ...reloadableProviders,
      ],
      exports: [...scopeExports, ...reloadableExports],
    };
  }

  static forRootAsync(
    options: ConfigProviderModuleAsyncOptions,
  ): DynamicModule {
    const { isGlobal = false, sources, scopes = [] } = options;

    const sourceNames = Object.keys(sources);

    const allImports: NonNullable<ModuleMetadata['imports']> = [];
    for (const src of Object.values(sources)) {
      if (src.imports) allImports.push(...src.imports);
    }

    const sourceProviders: Provider[] = Object.entries(sources).map(
      ([name, src]) => ({
        provide: sourceToken(name),
        useFactory: async (
          logger: LoggerService | undefined,
          ...args: unknown[]
        ) => {
          const instance = await src.useFactory(...args);
          if (logger) instance.setLogger(logger);
          return instance;
        },
        inject: [
          { token: LoggerService, optional: true },
          ...(src.inject || []),
        ],
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
      providers: [
        ...sourceProviders,
        ...scopeProviders,
        ...reloadableProviders,
      ],
      exports: [...scopeExports, ...reloadableExports],
    };
  }
}
