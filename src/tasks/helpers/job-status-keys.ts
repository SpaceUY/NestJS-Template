/**
 * Returns the key for the type of a job.
 * @param {string} jobId - The ID of the job.
 * @returns {string} The key for the type of the job.
 */
export const getJobTypeKey = (jobId: string): string => `job:${jobId}:type`;

/**
 * Returns the key for the status of a job.
 * @param {string} jobId - The ID of the job.
 * @returns {string} The key for the status of the job.
 */
export const getJobStatusKey = (jobId: string): string => `job:${jobId}:status`;

/**
 * Returns the key for the current task of a job.
 * @param {string} jobId - The ID of the job.
 * @returns {string} The key for the current task of the job.
 */
export function getJobCurrentTaskKey(jobId: string): string {
  return `job:${jobId}:currentTask`;
}

/**
 * Returns the key for the status of a job.
 * @param {string} jobId - The ID of the job.
 * @param {string} taskId - The ID of the task.
 * @returns {string} The key for the result of the job task.
 */
export function getJobTaskResultKey(jobId: string, taskId: string): string {
  return `job:${jobId}:task:${taskId}:result`;
}
