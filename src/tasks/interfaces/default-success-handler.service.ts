import { Injectable } from "@nestjs/common";
import { BaseSuccessHandlerService } from "./success-handler.base.service";

@Injectable()
export class DefaultSuccessHandlerService extends BaseSuccessHandlerService {
  // TODO: Use a different injection token.
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
