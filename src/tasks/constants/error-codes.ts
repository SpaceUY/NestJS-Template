/**
 * Error codes used throughout the application, to standardize error handling.
 * @enum {string}
 */
export const ERROR_CODES = {
  TASK_NOT_FOUND: "TASK_NOT_FOUND",
  SEQUENCE_NOT_FOUND: "SEQUENCE_NOT_FOUND",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
export const errorCodes = Object.values(ERROR_CODES);
