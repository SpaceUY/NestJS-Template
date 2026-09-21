import { rabbitmqScope, RabbitmqScopeConfig } from '../config/rabbitmq.scope';

const validate = (raw: Record<string, unknown>): RabbitmqScopeConfig => {
  if (!rabbitmqScope.validate) {
    throw new Error('rabbitmq scope has no validator');
  }
  return rabbitmqScope.validate(raw);
};

describe('rabbitmqScope', () => {
  it('falls back to a local broker', () => {
    expect(validate({})).toEqual({ url: 'amqp://localhost:5672' });
  });

  it('carries a configured URL through untouched, credentials included', () => {
    expect(
      validate({ url: 'amqps://app:a-password@broker.internal:5671' }),
    ).toEqual({ url: 'amqps://app:a-password@broker.internal:5671' });
  });

  it('refuses a URL that is not a string', () => {
    expect(() => validate({ url: 5672 })).toThrow(/url/);
  });

  it('refuses an empty URL rather than connecting to nothing', () => {
    expect(() => validate({ url: '' })).toThrow(/url/);
  });

  // A mistyped field name would otherwise resolve to the default and the
  // consumer would quietly connect to localhost instead of the real broker.
  it('refuses a key the scope does not declare', () => {
    expect(() => validate({ rabbitmqUrl: 'amqp://broker.internal' })).toThrow(
      /rabbitmqUrl/,
    );
  });
});
