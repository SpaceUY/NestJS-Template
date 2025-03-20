import { ERROR_CODES } from "@/common/enums/error-codes.enum";
import { JOB_STATUSES } from "@/common/enums/job-status.enum";
import { ApiException } from "@/common/expections/api.exception";
import { DynamoDBService } from "@/modules/infrastructure/aws/dynamodb/services/dynamodb.service";
import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";

// TODO: Perhaps move to an environment variable?
const TABLE_NAME = "jobs";

@Injectable()
export class TasksRepository {
  constructor(
    private readonly dynamoDBService: DynamoDBService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TasksRepository.name);
  }

  /**
   * Checks whether if the job has been completed, by querying the database (DynamoDB).
   * @param {string} jobId - The ID of the job.
   * @returns {Promise<void>}
   */
  async checkJobCompleted(jobId: string): Promise<void> {
    let result;

    try {
      result = await this.dynamoDBService.getItem(TABLE_NAME, {
        jobId: { S: jobId },
      });
    }
    catch (error) {
      throw new ApiException({
        code: ERROR_CODES.INVALID_INTERNAL_REQUEST,
        message: "Failed to check job status",
        data: { jobId, error: error.message },
      });
    }

    if (result?.status?.S === JOB_STATUSES.COMPLETED) {
      throw new ApiException({
        message: `Job ${jobId} has already been completed`,
        code: ERROR_CODES.JOB_ALREADY_COMPLETED,
      });
    }

    this.logger.debug({
      message: "Job not completed, proceeding with execution...",
      data: { jobId },
    });
  }

  /**
   * Persists a job in the database (DynamoDB).
   * This should not interrupt the flow of the task execution, but will later avoid
   * unnecessary re-executions of the same job. This supersedes caching once the job is completed,
   * and this is important because the cache is not a reliable long-term source of truth.
   * @param {string} jobId - The ID of the job.
   * @param {string} sequence - The sequence name.
   */
  async createJob(jobId: string, sequence: string): Promise<void> {
    try {
      await this.dynamoDBService.putItem(TABLE_NAME, {
        jobId: { S: jobId },
        status: { S: JOB_STATUSES.PENDING },
        type: { S: sequence },
      });

      this.logger.debug({
        message: "Job persisted in DynamoDB",
        data: { jobId, sequence, status: JOB_STATUSES.PENDING },
      });
    }
    catch (error) {
      this.logger.error({
        message: "Failed to persist job in DynamoDB",
        data: { jobId, sequence, error: error.message },
      });
    }
  }

  /**
   * Persists a job in the database (DynamoDB).
   * This should not interrupt the flow of the task execution, but will later avoid
   * unnecessary re-executions of the same job. This supersedes caching once the job is completed,
   * and this is important because the cache is not a reliable long-term source of truth.
   * @param {string} jobId - The ID of the job.
   * @param {string} sequence - The sequence name.
   */
  async completeJob(jobId: string): Promise<void> {
    try {
      await this.dynamoDBService.updateItem(
        TABLE_NAME,
        { jobId: { S: jobId } },
        "SET #status = :status",
        { ":status": { S: JOB_STATUSES.COMPLETED } },
        { "#status": "status" },
      );

      this.logger.debug({
        message: `Job updated to ${JOB_STATUSES.COMPLETED} in DynamoDB`,
        data: { jobId, status: JOB_STATUSES.COMPLETED },
      });
    }
    catch (error) {
      this.logger.error({
        message: "Failed to persist completed job in DynamoDB",
        data: { jobId, error: error.message },
      });
    }
  }
}
