import { DynamicModule, Module, Provider } from '@nestjs/common';
import { CONFIG_PROVIDER_ERRORS } from './config-provider-error-codes';
import {
  ConfigProviderModuleAsyncOptions,
  ConfigProviderModuleOptions,
  ConfigScopeDefinition,
  ConfigScopeFieldMapping,
} from './config-provider.interfaces';
import { ConfigProviderService } from './config-provider.service';

function sourceToken(name: string): string {
  return `CONFIG_PROVIDER_SOURCE_${name.toUpperCase()}`;
}

function buildScopeProviders(
  scopes: ConfigScopeDefinition<any>[],
  registeredSourceNames: string[],
): Provider[] {
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
        const sourceMap: Record<string, ConfigProviderService> = {};
        usedSources.forEach((name, i) => {
          sourceMap[name] = adapters[i];
        });

        const raw: Record<string, unknown> = {};
        for (const [field, mapping] of Object.entries(scope.fields) as [
          string,
          ConfigScopeFieldMapping,
        ][]) {
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
      },
      inject: usedSources.map(sourceToken),
    };
  });
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
    const scopeExports = scopes.map((s) => s.KEY);

    return {
      module: ConfigProviderAbstractModule,
      global: isGlobal,
      providers: [...sourceProviders, ...scopeProviders],
      exports: scopeExports,
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
    const scopeExports = scopes.map((s) => s.KEY);

    return {
      module: ConfigProviderAbstractModule,
      global: isGlobal,
      imports: allImports,
      providers: [...sourceProviders, ...scopeProviders],
      exports: scopeExports,
    };
  }
}
