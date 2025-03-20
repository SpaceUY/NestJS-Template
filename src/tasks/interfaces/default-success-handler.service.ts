import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { BaseSuccessHandlerService } from "./success-handler.base.service";

@Injectable()
export class DefaultSuccessHandlerService extends BaseSuccessHandlerService {
  constructor(private readonly logger: PinoLogger) {
    super();
  }

  handleSuccess(jobId: string): void {
    this.logger.warn({
      message: "No success handler defined for task sequence.",
      data: { jobId },
    });
  }
}
