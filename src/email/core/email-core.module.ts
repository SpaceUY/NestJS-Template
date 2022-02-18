import { DynamicModule, Module, Provider } from '@nestjs/common';
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
    const providers = emails.map((email) => ({
      provide: email['KEY'],
      inject: [email.templateRegistration['KEY'], EMAIL_SENDER_KEY],
      useFactory: (
        template: TemplateType<TemplateRegistration>,
        sender: SendgridSender,
      ) => ({
        send: (to: string, locals: TemplateLocals, options?: SenderOptions) => {
          const opts = email.defaultOptions;
          if (options) {
            for (const key of Object.keys(options)) {
              opts[key] = options[key];
            }
          }
          return sender.sendHTML(to, template.compileHTML(locals), opts);
        },
      }),
    }));

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
