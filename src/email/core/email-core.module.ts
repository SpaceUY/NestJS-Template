import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import emailConfig from 'src/config/email.config';
import {
  TemplateLocals,
  TemplateRegistration,
} from 'src/template/core/template-base';
import { TemplateType } from 'src/template/core/template-core.module';
import { TemplateModule } from 'src/template/template.module';
import { EmailRegistration } from './register-email';
import { SenderOptions } from './sender-options';
import { SendgridSender } from './sendgrid.sender';

export const EMAIL_SENDER_KEY = 'SENDER';

@Module({})
export class EmailCoreModule {
  static forRoot(emails: Array<EmailRegistration>): DynamicModule {
    const providers = emails.map((email) => {
      switch (email.type) {
        case 'TEMPLATE':
          return {
            provide: email['KEY'],
            inject: [email.templateRegistration['KEY'], EMAIL_SENDER_KEY],
            useFactory: (
              template: TemplateType<TemplateRegistration>,
              sender: SendgridSender,
            ) => ({
              send: (
                to: string,
                locals: TemplateLocals,
                options?: SenderOptions,
              ) => {
                const opts = email.defaultOptions || {};
                if (options) {
                  for (const key of Object.keys(options)) {
                    opts[key] = options[key];
                  }
                }
                return sender.sendHTML(to, template.compileHTML(locals), opts);
              },
            }),
          };
        case 'DYNAMIC':
          return {
            provide: email['KEY'],
            inject: [EMAIL_SENDER_KEY, emailConfig.KEY],
            useFactory: (
              sender: SendgridSender,
              emailConf: ConfigType<typeof emailConfig>,
            ) => ({
              send: (
                to: string,
                locals: TemplateLocals,
                options?: SenderOptions,
              ) => {
                const opts = email.defaultOptions || {};
                if (options) {
                  for (const key of Object.keys(options)) {
                    opts[key] = options[key];
                  }
                }
                // locals['ctaURL'] = emailConf.ctaURL;
                return sender.sendTemplate(to, email.templateId, locals, opts);
              },
            }),
          };
      }
    });

    return {
      module: EmailCoreModule,
      imports: [TemplateModule],
      providers: [
        {
          provide: EMAIL_SENDER_KEY,
          useClass: SendgridSender,
        },
        ...providers,
      ],
      exports: emails.map((email) => email['KEY']),
    };
  }
}
