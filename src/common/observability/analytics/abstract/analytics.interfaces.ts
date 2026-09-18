export interface CaptureEventInput {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}
