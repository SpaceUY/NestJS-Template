import { Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import emailConfig from 'src/config/email.config';
import sgMail = require('@sendgrid/mail');
import { ClientResponse } from '@sendgrid/mail';
import { SenderOptions } from './sender-options';

export class SendgridSender {
  constructor(
    @Inject(emailConfig.KEY)
    private readonly emailConf: ConfigType<typeof emailConfig>,
  ) {
    sgMail.setApiKey(emailConf.sendgrid.apiKey);
  }

  async sendHTML(
    to: string,
    html: string,
    options?: SenderOptions,
  ): Promise<ClientResponse> {
    options.from = options.from || this.emailConf.from;
    options.subject = options.subject || '';
    return sgMail
      .send({
        to,
        from: options.from,
        subject: options.subject,
        html,
      })
      .then((resp) => resp[0]);
  }
}
