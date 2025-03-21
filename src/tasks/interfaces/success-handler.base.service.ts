import { Injectable } from "@nestjs/common";

@Injectable()
export abstract class BaseSuccessHandlerService {
  abstract handleSuccess(jobId: string): void | Promise<void>;
}
