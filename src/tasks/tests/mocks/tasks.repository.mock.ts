import { TasksRepository } from "@/modules/core/tasks/background/providers/tasks.repository";
import { MockDynamoDBService } from "@/modules/infrastructure/aws/dynamodb/tests/mocks/dynamodb.service.mock";
import { MockLogger } from "@/modules/infrastructure/logger/tests/mocks/logger.mock";

export class MockTasksRepository extends TasksRepository {
  constructor() {
    super(new MockDynamoDBService(), new MockLogger());
  }

  public checkJobCompleted = jest.fn();
  public createJob = jest.fn();
  public completeJob = jest.fn();
};
