import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { SpaceshipNotificationProcessor } from './notification.processor';
import { EmailService } from '../../email/abstract/email.service';
import { TemplateService } from '../../templating/abstract/template.service';
import { LoggerService } from '../../common/logger/abstract/logger.service';
import { emailScope } from '../../email/config/email.scope';
import { notificationRecipientsScope } from './config/notification-recipients.scope';
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
  const mockNotificationConfig = {
    employeeEmails: ['a@spacedev.io', 'b@spacedev.io'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpaceshipNotificationProcessor,
        { provide: EmailService, useValue: mockEmailService },
        { provide: TemplateService, useValue: mockTemplateService },
        { provide: LoggerService, useValue: mockLogger },
        { provide: emailScope.KEY, useValue: mockEmailConfig },
        {
          provide: notificationRecipientsScope.KEY,
          useValue: mockNotificationConfig,
        },
      ],
    }).compile();

    processor = module.get<SpaceshipNotificationProcessor>(
      SpaceshipNotificationProcessor,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockNotificationConfig.employeeEmails = ['a@spacedev.io', 'b@spacedev.io'];
  });

  describe('process', () => {
    it('renders the template and sends the batch email to the configured recipients', async () => {
      const job = {
        data: {
          spaceshipUuid: 'ship-uuid-1',
          name: 'Falcon',
          fleet: 'Alpha',
        } as SpaceshipCreatedJobData,
      } as Job<SpaceshipCreatedJobData>;
      mockTemplateService.compile.mockResolvedValue('<html>rendered</html>');
      mockEmailService.sendEmailBatch.mockResolvedValue({
        statusCode: 200,
        body: {},
        headers: {},
      });

      await processor.process(job);

      expect(mockTemplateService.compile).toHaveBeenCalledWith(
        TEMPLATE_PATHS[TEMPLATES.SPACESHIP_CREATED],
        { name: 'Falcon', fleet: 'Alpha' },
      );
      expect(mockEmailService.sendEmailBatch).toHaveBeenCalledWith({
        to: mockNotificationConfig.employeeEmails,
        from: mockEmailConfig.from,
        subject: TEMPLATE_SUBJECTS[TEMPLATES.SPACESHIP_CREATED],
        content: { html: '<html>rendered</html>' },
      });
    });

    it('propagates the error when sending fails, so BullMQ retries the job', async () => {
      const job = {
        data: {
          spaceshipUuid: 'ship-uuid-1',
          name: 'Falcon',
          fleet: 'Alpha',
        } as SpaceshipCreatedJobData,
      } as Job<SpaceshipCreatedJobData>;
      const error = new Error('Resend down');
      mockTemplateService.compile.mockResolvedValue('<html>rendered</html>');
      mockEmailService.sendEmailBatch.mockRejectedValue(error);

      await expect(processor.process(job)).rejects.toThrow(error);
    });

    it('skips sending and logs a warning when there are no configured recipients', async () => {
      mockNotificationConfig.employeeEmails = [];
      const job = {
        data: {
          spaceshipUuid: 'ship-uuid-1',
          name: 'Falcon',
          fleet: 'Alpha',
        } as SpaceshipCreatedJobData,
      } as Job<SpaceshipCreatedJobData>;

      await processor.process(job);

      expect(mockTemplateService.compile).not.toHaveBeenCalled();
      expect(mockEmailService.sendEmailBatch).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith({
        message:
          'Skipped spaceship-created notification: no recipients configured',
        data: { spaceshipUuid: 'ship-uuid-1' },
      });
    });
  });

  describe('onFailed', () => {
    it('logs the definitive failure once retries are exhausted', () => {
      const job = {
        data: { spaceshipUuid: 'ship-uuid-1' },
        attemptsMade: 3,
        opts: { attempts: 3 },
      } as Job<SpaceshipCreatedJobData>;
      const error = new Error('Resend down');

      processor.onFailed(job, error);

      expect(mockLogger.error).toHaveBeenCalledWith({
        message: 'Spaceship-created notification failed after all retries',
        data: { spaceshipUuid: 'ship-uuid-1', attemptsMade: 3 },
        error,
      });
    });

    it('does not log when the job still has retries left', () => {
      const job = {
        data: { spaceshipUuid: 'ship-uuid-1' },
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as Job<SpaceshipCreatedJobData>;

      processor.onFailed(job, new Error('Resend down'));

      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('does nothing when the job is undefined', () => {
      processor.onFailed(undefined, new Error('boom'));

      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
