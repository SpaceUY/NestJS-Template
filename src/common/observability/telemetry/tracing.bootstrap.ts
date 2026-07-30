import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { getOtelConfig, OtelConfig } from './otel-env';

export function buildSdk(config: OtelConfig): NodeSDK | null {
  if (!config.enabled) return null;

  return new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      url: config.endpoint,
      headers: config.headers,
    }),
    instrumentations: [
      new HttpInstrumentation(),
      new NestInstrumentation(),
      new PgInstrumentation(),
      new IORedisInstrumentation(),
    ],
  });
}

const sdk = buildSdk(getOtelConfig());

if (sdk) {
  sdk.start();

  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .catch((err: unknown) => {
        console.error('Error shutting down OpenTelemetry SDK', err);
      })
      .finally(() => process.exit(0));
  });
}
