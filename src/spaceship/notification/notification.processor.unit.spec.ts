import { Test, TestingModule } from '@nestjs/testing';
import { SpaceshipNotificationProcessor } from './notification.processor';
import { MessageContext } from '../../queues/abstract/consumer/queue-consumer.interfaces';
import { EmailService } from '../../email/abstract/email.service';
import { TemplateService } from '../../templating/abstract/template.service';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { emailScope } from '../../email/config/email.scope';
import { NotificationRecipientsProvider } from './notification-recipients.provider';
import {
  TEMPLATES,
  TEMPLATE_PATHS,
  TEMPLATE_SUBJECTS,
} from '../../templates/template.const';
import { SpaceshipCreatedJobData } from './notification.types';

describe('SpaceshipNotificationProcessor', () => {
  let processor: SpaceshipNotificationProcessor;

  const mockEmailService = { sendEmail: jest.fn(), sendEmailBatch: jest.fn() };
  const mockTemplateService = { compile: jest.fn() };
  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const mockEmailConfig = { from: 'noreply@spacedev.io' };
  const mockRecipientsProvider = { getRecipients: jest.fn() };
  const defaultRecipients = ['a@spacedev.io', 'b@spacedev.io'];

  const buildContext = (deliveryCount: number): MessageContext => ({
    messageId: 'message-1',
    headers: {},
    deliveryCount,
    ack: jest.fn().mockResolvedValue(undefined),
    nack: jest.fn().mockResolvedValue(undefined),
  });

  const payload: SpaceshipCreatedJobData = {
    spaceshipUuid: 'ship-uuid-1',
    name: 'Falcon',
    fleet: 'Alpha',
  };

  beforeEach(async () => {
    mockRecipientsProvider.getRecipients.mockResolvedValue(defaultRecipients);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpaceshipNotificationProcessor,
        { provide: EmailService, useValue: mockEmailService },
        { provide: TemplateService, useValue: mockTemplateService },
        { provide: LoggerService, useValue: mockLogger },
        { provide: emailScope.KEY, useValue: mockEmailConfig },
        {
          provide: NotificationRecipientsProvider,
          useValue: mockRecipientsProvider,
        },
      ],
    }).compile();

    processor = module.get<SpaceshipNotificationProcessor>(
      SpaceshipNotificationProcessor,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handle', () => {
    it('renders the template and sends the batch email to the configured recipients', async () => {
      const ctx = buildContext(1);
      mockTemplateService.compile.mockResolvedValue('<html>rendered</html>');
      mockEmailService.sendEmailBatch.mockResolvedValue({
        statusCode: 200,
        body: {},
        headers: {},
      });

      await processor.handle(payload, ctx);

      expect(mockTemplateService.compile).toHaveBeenCalledWith(
        TEMPLATE_PATHS[TEMPLATES.SPACESHIP_CREATED],
        { name: 'Falcon', fleet: 'Alpha' },
      );
      expect(mockEmailService.sendEmailBatch).toHaveBeenCalledWith({
        to: defaultRecipients,
        from: mockEmailConfig.from,
        subject: TEMPLATE_SUBJECTS[TEMPLATES.SPACESHIP_CREATED],
        content: { html: '<html>rendered</html>' },
      });
      expect(mockLogger.log).toHaveBeenCalledWith({
        message: 'Processing spaceship-created notification',
        data: {
          spaceshipUuid: 'ship-uuid-1',
          messageId: 'message-1',
          deliveryCount: 1,
        },
      });
    });

    it('skips sending and logs a warning when there are no configured recipients', async () => {
      mockRecipientsProvider.getRecipients.mockResolvedValue([]);
      const ctx = buildContext(1);

      await processor.handle(payload, ctx);

      expect(mockTemplateService.compile).not.toHaveBeenCalled();
      expect(mockEmailService.sendEmailBatch).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith({
        message:
          'Skipped spaceship-created notification: no recipients configured',
        data: { spaceshipUuid: 'ship-uuid-1' },
      });
    });

    it('rethrows (letting the adapter nack with requeue) while retries remain', async () => {
      const ctx = buildContext(1);
      const error = new Error('Resend down');
      mockTemplateService.compile.mockResolvedValue('<html>rendered</html>');
      mockEmailService.sendEmailBatch.mockRejectedValue(error);

      await expect(processor.handle(payload, ctx)).rejects.toThrow(error);
      expect(ctx.nack).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('logs the definitive failure and nacks without requeue once retries are exhausted', async () => {
      const ctx = buildContext(3);
      const error = new Error('Resend down');
      mockTemplateService.compile.mockResolvedValue('<html>rendered</html>');
      mockEmailService.sendEmailBatch.mockRejectedValue(error);

      await processor.handle(payload, ctx);

      expect(mockLogger.error).toHaveBeenCalledWith({
        message: 'Spaceship-created notification failed after all retries',
        data: { spaceshipUuid: 'ship-uuid-1', deliveryCount: 3 },
        error,
      });
      expect(ctx.nack).toHaveBeenCalledWith({ requeue: false });
    });
  });
});
