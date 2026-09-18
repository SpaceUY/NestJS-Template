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
      url: `${config.endpoint.replace(/\/+$/, '')}/v1/traces`,
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

  // Do not force `process.exit()` here: `main.ts` also calls
  // `app.enableShutdownHooks()`, which registers its own SIGTERM listener
  // that awaits Nest's `onModuleDestroy` chain (including flushing the
  // analytics client). Both listeners run concurrently on SIGTERM, so
  // exiting from this one could kill the process before that chain
  // finishes. Let the process exit naturally once every handler drains.
  process.on('SIGTERM', () => {
    sdk.shutdown().catch((err: unknown) => {
      console.error('Error shutting down OpenTelemetry SDK', err);
    });
  });
}
