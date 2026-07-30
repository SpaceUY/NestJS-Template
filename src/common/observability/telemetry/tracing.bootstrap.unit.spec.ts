import { NodeSDK } from '@opentelemetry/sdk-node';
import { buildSdk } from './tracing.bootstrap';
import { OtelConfig } from './otel-env';

describe('buildSdk', () => {
  it('returns null when tracing is disabled', () => {
    const config: OtelConfig = {
      enabled: false,
      serviceName: '',
      endpoint: '',
      headers: {},
    };

    expect(buildSdk(config)).toBeNull();
  });

  it('returns a NodeSDK instance when tracing is enabled', () => {
    const config: OtelConfig = {
      enabled: true,
      serviceName: 'test-service',
      endpoint: 'http://localhost:4318',
      headers: {},
    };

    expect(buildSdk(config)).toBeInstanceOf(NodeSDK);
  });
});
