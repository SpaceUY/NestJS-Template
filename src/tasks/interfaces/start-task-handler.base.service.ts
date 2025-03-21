import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class BaseStartTaskHandlerService {
  abstract handleStartTask(
    jobId: string,
    taskId: string,
    payload: object,
  ): void | Promise<void>;
}
