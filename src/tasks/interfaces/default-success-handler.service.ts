import { Inject, Injectable } from '@nestjs/common';
import { BaseSuccessHandlerService } from './success-handler.base.service';
import { TASK_LOGGER } from '../constants/tokens';
import { TaskLogger } from './logger.interface';

@Injectable()
export class DefaultSuccessHandlerService extends BaseSuccessHandlerService {
  constructor(@Inject(TASK_LOGGER) private readonly logger: TaskLogger) {
    super();
  }

  handleSuccess(jobId: string): void {
    this.logger.warn({
      message: 'No success handler defined for task sequence.',
      data: { jobId },
    });
  }
}
