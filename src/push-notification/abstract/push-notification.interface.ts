export interface IPushNotification {
  title: string;
  body: string;
  data: Record<string, string>;
  deepLink?: string;
}
