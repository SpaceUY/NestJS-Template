import { Inject, Injectable } from '@nestjs/common';
import { QueueConsumerHandler } from '../../queues/abstract/consumer/queue-consumer.handler';
import { MessageContext } from '../../queues/abstract/consumer/queue-consumer.interfaces';
import { SpaceshipCreatedJobData } from './notification.types';
import { EmailService } from '../../email/abstract/email.service';
import { TemplateService } from '../../templating/abstract/template.service';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { emailScope, EmailScopeConfig } from '../../email/config/email.scope';
import { NotificationRecipientsProvider } from './notification-recipients.provider';
import {
  TEMPLATES,
  TEMPLATE_PATHS,
  TEMPLATE_SUBJECTS,
} from '../../templates/template.const';
import { SPACESHIP_NOTIFICATION_MAX_ATTEMPTS } from './notification.constants';

@Injectable()
export class SpaceshipNotificationProcessor extends QueueConsumerHandler<SpaceshipCreatedJobData> {
  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly logger: LoggerService,
    @Inject(emailScope.KEY)
    private readonly emailConfig: EmailScopeConfig,
    private readonly recipientsProvider: NotificationRecipientsProvider,
  ) {
    super();
    this.logger.setContext(SpaceshipNotificationProcessor.name);
  }

  async handle(
    payload: SpaceshipCreatedJobData,
    ctx: MessageContext,
  ): Promise<void> {
    const { spaceshipUuid, name, fleet } = payload;

    this.logger.log({
      message: 'Processing spaceship-created notification',
      data: {
        spaceshipUuid,
        messageId: ctx.messageId,
        deliveryCount: ctx.deliveryCount,
      },
    });

    try {
      const recipients = await this.recipientsProvider.getRecipients();

      if (recipients.length === 0) {
        this.logger.warn({
          message:
            'Skipped spaceship-created notification: no recipients configured',
          data: { spaceshipUuid },
        });
        return;
      }

      const html = await this.templateService.compile(
        TEMPLATE_PATHS[TEMPLATES.SPACESHIP_CREATED],
        { name, fleet },
      );

      await this.emailService.sendEmailBatch({
        to: recipients,
        from: this.emailConfig.from,
        subject: TEMPLATE_SUBJECTS[TEMPLATES.SPACESHIP_CREATED],
        content: { html },
      });

      this.logger.log({
        message: 'Spaceship-created notification sent',
        data: { spaceshipUuid, recipients: recipients.length },
      });
    } catch (error) {
      if ((ctx.deliveryCount ?? 1) < SPACESHIP_NOTIFICATION_MAX_ATTEMPTS) {
        // Rethrow: the adapter nacks with requeue, BullMQ redelivers per its
        // own backoff.
        throw error;
      }

      this.logger.error({
        message: 'Spaceship-created notification failed after all retries',
        data: { spaceshipUuid, deliveryCount: ctx.deliveryCount },
        error,
      });
      await ctx.nack({ requeue: false });
    }
  }
}
