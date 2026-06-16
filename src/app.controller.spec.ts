import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import baseConfig from './config/base.config';
import emailConfig from './config/email.config';
import { EmailService } from './email/abstract/email.service';
import { TemplateService } from './templating/abstract/template.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: baseConfig.KEY,
          useValue: {
            nodeEnv: 'TEST',
            port: 5000,
            selfUrl: 'http://localhost:5000',
          },
        },
        {
          provide: emailConfig.KEY,
          useValue: { adapter: 'CONSOLE', from: 'test@example.com' },
        },
        {
          provide: EmailService,
          useValue: { sendEmail: jest.fn(), sendEmailBatch: jest.fn() },
        },
        { provide: TemplateService, useValue: { compile: jest.fn() } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World! TEST');
    });
  });
});
