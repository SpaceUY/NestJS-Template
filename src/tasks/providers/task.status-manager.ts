import { Inject, Injectable } from "@nestjs/common";
import type { JobStatus } from "../constants/job-statuses";
import { type EmptyPayload, EMPTY_PAYLOAD } from "../constants/payloads";

import {
  getJobCurrentTaskKey,
  getJobStatusKey,
  getJobTaskResultKey,
  getJobTypeKey,
} from "../helpers/job-status-keys";
import { TASK_LOGGER } from "../constants/tokens";
import { TaskLogger } from "../interfaces/logger.interface";

/**
 * Manages the status of jobs.
 */
@Injectable()
export class TaskStatusManager {
  constructor(
    @Inject(TASK_LOGGER) private readonly logger: TaskLogger,
    // private readonly cacheService: CacheService,
  ) {
    this.logger.setContext(TaskStatusManager.name);
  }

  // ===== Job Type =====
  /**
   * Sets the type of a job.
   * @param {string} jobId - The ID of the job.
   * @param {string} sequenceName - The type of the job, identified by the sequence name.
   */
  async setJobType(jobId: string, sequenceName: string): Promise<void> {
    this.logger.debug({
      message: "Setting job type metadata...",
      data: { jobId, sequenceName },
    });

    const key = getJobTypeKey(jobId);
    // TODO: Implement cache set.
    // await this.cacheService.set(key, sequenceName);
  }

  /**
   * Gets the status of a job.
   * @param {string} jobId - The ID of the job.
   * @returns {Promise<JobStatus>} The status of the job.
   */
  async getJobType(jobId: string): Promise<string | undefined> {
    this.logger.debug({
      message: "Getting job type...",
      data: { jobId },
    });

    const key = getJobTypeKey(jobId);
    // TODO: Implement cache get.
    // return this.cacheService.get(key) as Promise<string | undefined>;
    return 'todo!';
  }

  // ===== Job Status =====
  /**
   * Sets the status of a job.
   * @param {string} jobId - The ID of the job.
   * @param {JobStatus} status - The status of the job.
   */
  async setJobStatus(jobId: string, status: JobStatus): Promise<void> {
    this.logger.debug({
      message: `Updating job status...`,
      data: { jobId, status },
    });

    const key = getJobStatusKey(jobId);
    // TODO: Implement cache set.
    // await this.cacheService.set(key, status);
  }

  /**
   * Gets the status of a job.
   * @param {string} jobId - The ID of the job.
   * @returns {Promise<JobStatus>} The status of the job.
   */
  async getJobStatus(jobId: string): Promise<JobStatus | undefined> {
    this.logger.debug({
      message: `Getting job status...`,
      data: { jobId },
    });

    const key = getJobStatusKey(jobId);
    // TODO: Implement cache get.
    // return this.cacheService.get(key) as Promise<JobStatus | undefined>;
    return;
  }

  // ===== Current Task =====
  /**
   * Sets the current task of a job.
   * @param {string} jobId - The ID of the job.
   * @param {string} taskId - The ID of the task.
   */
  async setCurrentTask(jobId: string, taskId: string): Promise<void> {
    this.logger.debug({
      message: `Setting current task for job...`,
      data: { jobId, taskId },
    });

    const key = getJobCurrentTaskKey(jobId);
    // TODO: Implement cache set.
    // await this.cacheService.set(key, taskId);
  }

  /**
   * Gets the current task of a job.
   * @param {string} jobId - The ID of the job.
   * @returns {Promise<string>} The ID of the current task.
   */
  async getCurrentTask(jobId: string): Promise<string | undefined> {
    this.logger.debug({
      message: `Getting current task for job...`,
      data: { jobId },
    });

    const key = getJobCurrentTaskKey(jobId);
    // TODO: Implement cache get.
    // return this.cacheService.get(key) as Promise<string | undefined>;
    return 'todo!';
  }

  // ===== Job task result =====
  /**
   * Sets the result of a job task in cache.
   * @param {string} jobId - The ID of the job.
   * @param {string} taskId - The ID of the task.
   * @param {object} result ? - The result of the task to store in cache.
   */
  async setTaskResult(
    jobId: string,
    taskId: string,
    result?: object,
  ): Promise<void> {
    this.logger.debug({
      message: `Setting current task for job...`,
      data: { jobId, taskId },
    });

    const key = getJobTaskResultKey(jobId, taskId);
    const data = result ? JSON.stringify(result) : EMPTY_PAYLOAD;
    // TODO: Implement cache set.
    // await this.cacheService.set(key, data);
  }

  /**
   * Gets the result of a job task in cache.
   * @param {string} jobId - The ID of the job.
   * @param {string} taskId - The ID of the task.
   * @returns {Promise<string | EmptyPayload>} The ID of the current task.
   */
  async getTaskResult(
    jobId: string,
    taskId: string,
  ): Promise<object | EmptyPayload | undefined> {
    this.logger.debug({
      message: `Getting current task for job...`,
      data: { jobId, taskId },
    });

    const key = getJobTaskResultKey(jobId, taskId);
    // TODO: Implement cache get.
    // const data = await this.cacheService.get(key);
    const data: string = 'todo!';

    if (data === EMPTY_PAYLOAD)
      return EMPTY_PAYLOAD;
    if (!data)
      return undefined;
    return JSON.parse(data);
  }
}
