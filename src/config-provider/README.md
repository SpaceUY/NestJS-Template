# Config Provider Module

Provider-agnostic configuration with typed, validated scopes that can be sourced from environment variables or AWS Secrets Manager — or both at once.

---

## Core Concept

Three independent layers compose the full system:

1. **Source adapters** — know how to fetch a raw string by key (`EnvConfigAdapter`, `SecretsManagerConfigAdapter`)
2. **`ConfigProviderAbstractModule`** — wires adapters to named source slots and resolves scopes at app startup
3. **Scopes** — live next to the consuming module; declare which keys to fetch, from which source, and how to validate/coerce them

---

## Directory Structure

```text
src/config-provider/
├── abstract/
│   ├── config-provider-abstract.module.ts   Dynamic module (forRoot / forRootAsync)
│   ├── config-provider.service.ts           Abstract source adapter contract
│   ├── config-provider.interfaces.ts        Shared types
│   ├── config-provider-error-codes.ts       Error string constants
│   ├── config-source.util.ts                configSources helper (from.env / from.sm / from.from)
│   └── define-config-scope.util.ts          defineConfigScope() utility
├── env-adapter/
│   └── env-config.adapter.ts                Wraps NestJS ConfigService
└── secrets-manager-adapter/
    ├── secrets-manager-config.adapter.ts    Fetches + caches an AWS Secrets Manager secret
    └── secrets-manager-config.interfaces.ts SecretsManagerAdapterOptions
```

Scopes live next to the module that consumes them:

```text
src/auth/config/jwt.scope.ts
src/auth/google/config/google.scope.ts
src/cloud-storage/s3-adapter/config/s3.scope.ts
src/email/config/email.scope.ts
src/push-notification/expo-adapter/config/expo.scope.ts
src/app.scope.ts
```

---

## Registration

Register once in `AppModule`. All scopes become globally available.

```ts
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConfigProviderAbstractModule } from './config-provider/abstract/config-provider-abstract.module';
import { EnvConfigAdapter } from './config-provider/env-adapter/env-config.adapter';
import { SecretsManagerConfigAdapter } from './config-provider/secrets-manager-adapter/secrets-manager-config.adapter';
import { appScope } from './app.scope';
import { jwtScope } from './auth/config/jwt.scope';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ConfigProviderAbstractModule.forRootAsync({
      isGlobal: true,
      sources: {
        env: {
          inject: [ConfigService],
          useFactory: (cs: ConfigService) => new EnvConfigAdapter(cs),
        },
        sm: {
          useFactory: () =>
            new SecretsManagerConfigAdapter({
              secretName: 'myapp/prod',
              region: 'us-east-1',
            }),
        },
      },
      scopes: [appScope, jwtScope /* ... */],
    }),
  ],
})
export class AppModule {}
```

`forRoot` is also available for the synchronous case (e.g. in tests), accepting `useClass` or `useValue` per source.

---

## Defining Scopes

Use `defineConfigScope` alongside `configSources` to declare what to fetch and from where.

```ts
// src/auth/config/jwt.scope.ts
import Joi = require('joi');
import { configSources as from } from '../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../config-provider/abstract/define-config-scope.util';

export type JwtScopeConfig = {
  secret: string;
  expiresIn: string;
  ignoreExpiration: boolean;
};

export const jwtScope = defineConfigScope<JwtScopeConfig>(
  'jwt',
  {
    secret:           from.env('JWT_SECRET'),
    expiresIn:        from.env('JWT_EXPIRES_IN'),
    ignoreExpiration: from.env('JWT_IGNORE_EXPIRATION'),
  },
  Joi.object<JwtScopeConfig>({
    secret:           Joi.string().default('Not A Safe Secret'),
    expiresIn:        Joi.string().default('7d'),
    ignoreExpiration: Joi.boolean().default(false),
  }),
);
```

### Injecting a scope

```ts
import { Inject } from '@nestjs/common';
import { jwtScope, JwtScopeConfig } from '../config/jwt.scope';

@Injectable()
export class AuthTokenService {
  constructor(
    @Inject(jwtScope.KEY)
    private readonly jwtConf: JwtScopeConfig,
  ) {}
}
```

`jwtScope.KEY` is the string `'CONFIG_SCOPE_JWT'` — a plain NestJS injection token.

---

## `configSources` Helper

Import as `from` for readable field declarations:

```ts
import { configSources as from } from '../../config-provider/abstract/config-source.util';

fields: {
  apiKey:    from.env('API_KEY'),       // reads from the 'env' source
  dbPass:    from.sm('DB_PASSWORD'),    // reads from the 'sm' source
  internal:  from.from('vault')('KEY'), // reads from a custom-named source
}
```

`from.env` and `from.sm` are shorthand for the `'env'` and `'sm'` source names used in the module registration above. `from.from(sourceName)` handles any other registered source name.

---

## Mixing Sources

A scope can pull fields from different sources. The module resolves each independently at startup.

```ts
export const serviceScope = defineConfigScope<ServiceScopeConfig>(
  'service',
  {
    port:      from.env('PORT'),         // non-sensitive → env
    apiSecret: from.sm('API_SECRET'),    // sensitive → Secrets Manager
    dbUrl:     from.sm('DATABASE_URL'),  // sensitive → Secrets Manager
  },
  Joi.object({ ... }),
);
```

---

## Transformations

All raw values arrive as `string | undefined`. Joi coerces them before the validated object is returned, so consuming code always receives the correct type.

### Boolean coercion

```ts
// JWT_IGNORE_EXPIRATION=true → ignoreExpiration: true (boolean)
ignoreExpiration: Joi.boolean().default(false)
```

### Number coercion

```ts
// PORT=3000 → port: 3000 (number)
port: Joi.number().integer().min(1024).max(65535).default(5000)
```

### Enum validation

```ts
// NODE_ENV=PROD → nodeEnv: 'PROD' (string, validated)
nodeEnv: Joi.string().valid('DEV', 'TEST', 'PROD').default('DEV')
```

### Conditional requirements

```ts
// clientId is only required when enabled=true
enabled:  Joi.boolean().default(false),
clientId: Joi.string().when('enabled', {
  is: true,
  then: Joi.required(),
  otherwise: Joi.optional(),
}),
```

### Derived fields

Use `.custom()` to compute a field from other values in the same scope:

```ts
Joi.object({
  selfUrl:     Joi.string().default('http://localhost:5000'),
  callbackUrl: Joi.string().optional(),
}).custom((value) => {
  if (!value.callbackUrl) {
    value.callbackUrl = `${value.selfUrl}/auth/callback`;
  }
  return value;
})
```

### Custom parsing

```ts
// ALLOWED_ORIGINS=http://a.com,http://b.com → allowedOrigins: string[]
allowedOrigins: Joi.string()
  .default('')
  .custom((val) => val ? val.split(',').map((s: string) => s.trim()) : [])
  .default([])
```

---

## Source Adapters

### `EnvConfigAdapter`

Wraps NestJS `ConfigService`. Requires `ConfigModule.forRoot({ isGlobal: true })` to be registered.

```ts
sources: {
  env: {
    inject: [ConfigService],
    useFactory: (cs: ConfigService) => new EnvConfigAdapter(cs),
  },
}
```

### `SecretsManagerConfigAdapter`

Fetches a single AWS Secrets Manager secret (JSON object) and resolves individual keys from it. The secret is cached in memory after the first fetch by default.

```ts
sources: {
  sm: {
    useFactory: () =>
      new SecretsManagerConfigAdapter({
        secretName: 'myapp/prod',   // required — AWS secret name or ARN
        region: 'us-east-1',        // optional — falls back to SDK default
        accessKeyId: '...',         // optional — falls back to IAM role
        secretAccessKey: '...',     // optional — falls back to IAM role
        cacheSecret: true,          // optional — default true
      }),
  },
}
```

The secret stored in AWS must be a JSON object where each key maps to a string value:

```json
{
  "JWT_SECRET": "s3cr3t",
  "DATABASE_URL": "postgres://..."
}
```

---

## Hot Reload

`SecretsManagerConfigAdapter` extends `ReloadableConfigProviderService`, which adds a `reload()` method. Calling it clears the in-memory cache and immediately re-fetches the secret from AWS, so subsequent reads return the updated values.

`EnvConfigAdapter` does not implement this interface — environment variables do not change at runtime.

### Per-source reload tokens

For every registered source the module exports a `reloadableSourceToken(name)` provider, mirroring the same spread pattern as the source providers themselves. The provider resolves to the adapter instance if it is reloadable, or `null` if not.

```ts
import { Controller, Post } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { reloadableSourceToken } from './config-provider/abstract/config-provider-tokens';
import { ReloadableConfigProviderService } from './config-provider/abstract/reloadable-config-provider.service';

@Controller('config')
export class ConfigController {
  constructor(
    @Inject(reloadableSourceToken('sm'))
    private readonly smAdapter: ReloadableConfigProviderService,
  ) {}

  @Post('reload')
  async reload(): Promise<void> {
    await this.smAdapter.reload();
  }
}
```

Injecting a non-reloadable source (e.g. `reloadableSourceToken('env')`) resolves to `null` — guard accordingly if needed.

### Live scopes

By default scopes resolve once at app startup — the factory runs, returns a plain object, and that snapshot is injected everywhere. Hot reload refreshes the adapter cache but plain scopes never see the new values.

Pass `{ live: true }` to `defineConfigScope` to opt in. The scope resolves to a `Proxy` backed by a mutable reference. When any reloadable source adapter fires `reload()`, the proxy's reference is updated in place — the injected object in consuming services automatically reflects the new values without any re-injection.

```ts
export const featureScope = defineConfigScope<FeatureScopeConfig>(
  'feature',
  {
    rateLimit: from.sm('RATE_LIMIT'),
    flagEnabled: from.sm('FLAG_ENABLED'),
  },
  Joi.object<FeatureScopeConfig>({
    rateLimit: Joi.number().integer().default(100),
    flagEnabled: Joi.boolean().default(false),
  }),
  { live: true }, // ← opt-in
);
```

The consuming service is unchanged — property access just always reads the current value:

```ts
@Injectable()
export class FeatureService {
  constructor(
    @Inject(featureScope.KEY)
    private readonly conf: FeatureScopeConfig,
  ) {}

  isEnabled(): boolean {
    return this.conf.flagEnabled; // reflects the latest reloaded value
  }
}
```

`Object.keys()` and spread (`{ ...conf }`) also reflect the current state at the moment of the call.

For most application config (JWT secrets, DB URLs, adapter options) the default static scope is correct and desirable. Reserve `live: true` for config that genuinely changes at runtime — feature flags, rate limits, rotating credentials.

---

## Error Codes

| Constant | Meaning |
|---|---|
| `CONFIG_PROVIDER_KEY_NOT_FOUND` | `getOrThrow` called for a key absent from the source |
| `CONFIG_PROVIDER_SCOPE_VALIDATION_FAILED` | Joi validation rejected the resolved scope values |
| `CONFIG_PROVIDER_SECRET_FETCH_FAILED` | SecretsManager network/auth error |
| `CONFIG_PROVIDER_UNKNOWN_SOURCE` | A scope references a source name not registered in the module |

The last error (`UNKNOWN_SOURCE`) is thrown **at registration time** (module init), not at runtime, so misconfiguration is caught immediately on app startup.
