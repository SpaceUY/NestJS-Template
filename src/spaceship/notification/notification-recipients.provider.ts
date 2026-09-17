export abstract class NotificationRecipientsProvider {
  abstract getRecipients(): Promise<string[]>;
}
