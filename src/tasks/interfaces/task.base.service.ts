import { Injectable } from "@nestjs/common";

@Injectable()
export abstract class BaseTaskService {
  abstract execute(payload: object): Promise<object | undefined>;
}
