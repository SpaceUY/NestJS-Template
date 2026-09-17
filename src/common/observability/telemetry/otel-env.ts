import * as Joi from 'joi';

// Deliberately doesn't use defineConfigScope/ConfigProviderAbstractModule like
// every other *.scope.ts file. That system resolves values through Nest DI at
// module-registration time, but this file is read by tracing.bootstrap.ts,
// which runs as the first line of main.ts — before NestFactory.create(), so
// before the Nest module graph (and its DI container) exists. OTel's
// instrumentations must patch http/pg/ioredis before those modules are
// require()'d anywhere else, including inside ConfigProviderAbstractModule
// itself; waiting for Nest DI would make that impossible. This mirrors a
// *.scope.ts file's style (typed config, Joi validation) but reads
// process.env directly — the one deliberate exception in this codebase.

export interface OtelConfig {
  enabled: boolean;
  serviceName: string;
  endpoint: string;
  headers: Record<string, string>;
}

interface RawOtelEnv {
  endpoint?: string;
  serviceName: string;
  headers?: string;
}

const schema = Joi.object<RawOtelEnv>({
  endpoint: Joi.string().uri().optional(),
  serviceName: Joi.string().default('nestjs-template'),
  headers: Joi.string().optional(),
});

export function getOtelConfig(
  env: NodeJS.ProcessEnv = process.env,
): OtelConfig {
  const raw = {
    endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    serviceName: env.OTEL_SERVICE_NAME,
    headers: env.OTEL_EXPORTER_OTLP_HEADERS,
  };

  const { error, value } = schema.validate(raw, { abortEarly: false });
  if (error) {
    throw new Error(`Invalid OTEL environment configuration: ${error.message}`);
  }

  if (!value.endpoint) {
    return { enabled: false, serviceName: '', endpoint: '', headers: {} };
  }

  return {
    enabled: true,
    serviceName: value.serviceName,
    endpoint: value.endpoint,
    headers: parseHeaders(value.headers),
  };
}

function parseHeaders(raw?: string): Record<string, string> {
  if (!raw) return {};

  const headers: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const [key, val] = pair.split('=');
    if (key?.trim() && val?.trim()) {
      headers[key.trim()] = val.trim();
    }
  }
  return headers;
}
