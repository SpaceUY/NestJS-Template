import { Inject, Injectable } from '@nestjs/common';
import { BaseErrorHandlerService } from '../interfaces/error-handler.base.service';
import { TASK_LOGGER } from '../constants/tokens';
import { TaskLogger } from '../interfaces/logger.interface';

@Injectable()
export class DefaultErrorHandlerService extends BaseErrorHandlerService {
  constructor(@Inject(TASK_LOGGER) private readonly logger: TaskLogger) {
    super();
  }

  handleError(jobId: string, error: Error): void {
    this.logger.warn({
      message: 'No error handler defined for task sequence.',
      data: { jobId, error: error.message },
    });
  }
}
