/**
 * Possible statuses of a job.
 * @enum {string}
 */
export const JOB_STATUSES = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type JobStatus = (typeof JOB_STATUSES)[keyof typeof JOB_STATUSES];
export const jobStatuses = Object.values(JOB_STATUSES);
