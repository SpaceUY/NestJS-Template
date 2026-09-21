import {
  ANALYTICS_ADAPTERS,
  analyticsScope,
  AnalyticsScopeConfig,
} from './analytics.scope';

const validate = (raw: Record<string, unknown>): AnalyticsScopeConfig => {
  if (!analyticsScope.validate) {
    throw new Error('analytics scope has no validator');
  }
  return analyticsScope.validate(raw);
};

describe('analyticsScope', () => {
  it('defaults to the console adapter with no PostHog credentials', () => {
    expect(validate({})).toEqual({
      adapter: ANALYTICS_ADAPTERS.CONSOLE,
      posthogApiKey: '',
      posthogHost: 'https://us.i.posthog.com',
    });
  });

  it('refuses an adapter the factory in app.module cannot build', () => {
    expect(() => validate({ adapter: 'MIXPANEL' })).toThrow(/adapter/);
  });

  // The PostHog adapter constructs its client from this key. An absent one
  // would otherwise reach the SDK as `undefined` and fail at the first
  // capture, far from the missing environment variable that caused it.
  it('requires an API key once the PostHog adapter is selected', () => {
    expect(() => validate({ adapter: ANALYTICS_ADAPTERS.POSTHOG })).toThrow(
      /posthogApiKey/,
    );
  });

  it('refuses an empty API key for the PostHog adapter', () => {
    expect(() =>
      validate({ adapter: ANALYTICS_ADAPTERS.POSTHOG, posthogApiKey: '' }),
    ).toThrow(/posthogApiKey/);
  });

  it('accepts the PostHog adapter with a key and keeps the default host', () => {
    expect(
      validate({
        adapter: ANALYTICS_ADAPTERS.POSTHOG,
        posthogApiKey: 'phc_a_key',
      }),
    ).toEqual({
      adapter: ANALYTICS_ADAPTERS.POSTHOG,
      posthogApiKey: 'phc_a_key',
      posthogHost: 'https://us.i.posthog.com',
    });
  });

  it('keeps a self-hosted PostHog host', () => {
    expect(
      validate({
        adapter: ANALYTICS_ADAPTERS.POSTHOG,
        posthogApiKey: 'phc_a_key',
        posthogHost: 'https://posthog.internal',
      }).posthogHost,
    ).toBe('https://posthog.internal');
  });

  it('does not require a key while the console adapter is selected', () => {
    expect(
      validate({ adapter: ANALYTICS_ADAPTERS.CONSOLE }).posthogApiKey,
    ).toBe('');
  });

  it('refuses a key the scope does not declare', () => {
    expect(() => validate({ posthogKey: 'phc_a_key' })).toThrow(/posthogKey/);
  });
});
