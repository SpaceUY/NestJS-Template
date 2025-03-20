import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { BaseErrorHandlerService } from "./error-handler.base.service";

@Injectable()
export class DefaultErrorHandlerService extends BaseErrorHandlerService {
  constructor(private readonly logger: PinoLogger) {
    super();
  }

  handleError(jobId: string, error: Error): void {
    this.logger.warn({
      message: "No error handler defined for task sequence.",
      data: { jobId, error: error.message },
    });
  }
}
