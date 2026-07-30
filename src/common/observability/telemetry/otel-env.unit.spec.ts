import { getOtelConfig } from './otel-env';

describe('getOtelConfig', () => {
  it('is disabled when OTEL_EXPORTER_OTLP_ENDPOINT is not set', () => {
    const config = getOtelConfig({});

    expect(config).toEqual({
      enabled: false,
      serviceName: '',
      endpoint: '',
      headers: {},
    });
  });

  it('is enabled with defaults when only the endpoint is set', () => {
    const config = getOtelConfig({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4317',
    });

    expect(config).toEqual({
      enabled: true,
      serviceName: 'nestjs-template',
      endpoint: 'http://localhost:4317',
      headers: {},
    });
  });

  it('uses a custom service name when provided', () => {
    const config = getOtelConfig({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4317',
      OTEL_SERVICE_NAME: 'my-api',
    });

    expect(config.serviceName).toBe('my-api');
  });

  it('parses comma-separated key=value headers', () => {
    const config = getOtelConfig({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4317',
      OTEL_EXPORTER_OTLP_HEADERS: 'api-key=abc123,x-custom=val',
    });

    expect(config.headers).toEqual({
      'api-key': 'abc123',
      'x-custom': 'val',
    });
  });

  it('throws when the endpoint is not a valid URI', () => {
    expect(() =>
      getOtelConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: 'not-a-url' }),
    ).toThrow(/Invalid OTEL environment configuration/);
  });
});
