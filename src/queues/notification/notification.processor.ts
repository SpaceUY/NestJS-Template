import { Inject } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SPACESHIP_NOTIFICATION_QUEUE } from './notification.constants';
import { SpaceshipCreatedJobData } from './notification.types';
import { EmailService } from '../../email/abstract/email.service';
import { TemplateService } from '../../templating/abstract/template.service';
import { LoggerService } from '../../common/logger/abstract/logger.service';
import { emailScope, EmailScopeConfig } from '../../email/config/email.scope';
import {
  notificationRecipientsScope,
  NotificationRecipientsScopeConfig,
} from './config/notification-recipients.scope';
import {
  TEMPLATES,
  TEMPLATE_PATHS,
  TEMPLATE_SUBJECTS,
} from '../../templates/template.const';

@Processor(SPACESHIP_NOTIFICATION_QUEUE)
export class SpaceshipNotificationProcessor extends WorkerHost {
  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly logger: LoggerService,
    @Inject(emailScope.KEY)
    private readonly emailConfig: EmailScopeConfig,
    @Inject(notificationRecipientsScope.KEY)
    private readonly notificationConfig: NotificationRecipientsScopeConfig,
  ) {
    super();
    this.logger.setContext(SpaceshipNotificationProcessor.name);
  }

  async process(job: Job<SpaceshipCreatedJobData>): Promise<void> {
    const { spaceshipUuid, name, fleet } = job.data;

    this.logger.log({
      message: 'Processing spaceship-created notification',
      data: { spaceshipUuid, jobId: job.id, attemptsMade: job.attemptsMade },
    });

    if (this.notificationConfig.employeeEmails.length === 0) {
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
      to: this.notificationConfig.employeeEmails,
      from: this.emailConfig.from,
      subject: TEMPLATE_SUBJECTS[TEMPLATES.SPACESHIP_CREATED],
      content: { html },
    });

    this.logger.log({
      message: 'Spaceship-created notification sent',
      data: {
        spaceshipUuid,
        recipients: this.notificationConfig.employeeEmails.length,
      },
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SpaceshipCreatedJobData> | undefined, error: Error): void {
    if (!job) return;

    const attemptsExhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (!attemptsExhausted) return;

    this.logger.error({
      message: 'Spaceship-created notification failed after all retries',
      data: {
        spaceshipUuid: job.data.spaceshipUuid,
        attemptsMade: job.attemptsMade,
      },
      error,
    });
  }
}
