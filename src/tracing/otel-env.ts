import * as Joi from 'joi';

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
