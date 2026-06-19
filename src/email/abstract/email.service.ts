import {
  MailingResponse,
  SendRenderedEmailParams,
  SendRenderedEmailMultipleParams,
} from './email.interface';
import { LoggerService } from '../../common/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/logger/nest-adapter/nest-logger.adapter';

export abstract class EmailService {
  protected logger: LoggerService = new NestLoggerAdapter(this.constructor.name);

  setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  /**
   * Sends an email using pre-rendered content
   */
  abstract sendEmail(params: SendRenderedEmailParams): Promise<MailingResponse>;

  /**
   * Sends multiple emails using pre-rendered content
   */
  abstract sendEmailBatch(
    params: SendRenderedEmailMultipleParams,
  ): Promise<MailingResponse>;
}
