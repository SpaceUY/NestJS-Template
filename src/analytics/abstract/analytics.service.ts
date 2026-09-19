import { CaptureEventInput } from './analytics.interfaces';

/**
 * Contract all analytics adapters must satisfy. Inject this token in other
 * modules — never a concrete adapter class — so the adapter can be swapped
 * without touching consumers.
 */
export abstract class AnalyticsService {
  abstract capture(input: CaptureEventInput): void;
  abstract isFeatureEnabled(key: string, distinctId: string): Promise<boolean>;
  abstract getFeatureFlag(
    key: string,
    distinctId: string,
  ): Promise<string | boolean | undefined>;
}
