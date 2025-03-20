import type {
  EmptyPayload,
} from "@/common/constants/defaults";
// ==== Enums & Constants & Helpers ====
import type { JobStatus } from "@/common/enums/job-status.enum";

import {
  EMPTY_PAYLOAD,
} from "@/common/constants/defaults";
import {
  getJobCurrentTaskKey,
  getJobStatusKey,
  getJobTaskResultKey,
  getJobTypeKey,
} from "@/common/helpers/job-status-keys";
// ==== Services ====
import { CacheService } from "@/modules/infrastructure/cache/cache.service";
import { Injectable } from "@nestjs/common";

import { PinoLogger } from "nestjs-pino";

/**
 * Manages the status of jobs.
 */
@Injectable()
export class TaskStatusManager {
  constructor(
    private readonly logger: PinoLogger,
    private readonly cacheService: CacheService,
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
    await this.cacheService.set(key, sequenceName);
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
    return this.cacheService.get(key) as Promise<string | undefined>;
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
    await this.cacheService.set(key, status);
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
    return this.cacheService.get(key) as Promise<JobStatus | undefined>;
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
    await this.cacheService.set(key, taskId);
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
    return this.cacheService.get(key) as Promise<string | undefined>;
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
    await this.cacheService.set(key, data);
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
    const data = await this.cacheService.get(key);

    if (data === EMPTY_PAYLOAD)
      return EMPTY_PAYLOAD;
    if (!data)
      return undefined;
    return JSON.parse(data);
  }
}
