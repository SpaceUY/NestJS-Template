import { Injectable } from "@nestjs/common";

@Injectable()
export abstract class BaseErrorHandlerService {
  abstract handleError(jobId: string, error: Error): void | Promise<void>;
}
