import { EmailService } from '../email.service';
import { MailingResponse } from '../email.interface';
import { LoggerService } from '../../../common/observability/logger/abstract/logger.service';

const RESPONSE: MailingResponse = { statusCode: 200, body: {}, headers: {} };

export class MockEmailService extends EmailService {
  sendEmail = jest.fn().mockResolvedValue(RESPONSE);
  sendEmailBatch = jest.fn().mockResolvedValue(RESPONSE);

  /** `logger` is protected on the abstract class; this keeps assertions honest. */
  exposeLogger(): LoggerService {
    return this.logger;
  }
}
