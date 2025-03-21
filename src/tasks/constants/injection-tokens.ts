export const SEQUENCE_DEFINITION_PREFIX = 'SEQUENCE_DEFINITIONS';
export const SEQUENCE_ERROR_HANDLER_PREFIX = 'SEQUENCE_ERROR_HANDLER';
export const SEQUENCE_SUCCESS_HANDLER_PREFIX = 'SEQUENCE_SUCCESS_HANDLER';
export const SEQUENCE_START_TASK_HANDLER_PREFIX = 'SEQUENCE_START_TASK_HANDLER';

export function createSequenceDefinitionToken(moduleName: string): string {
  return `${SEQUENCE_DEFINITION_PREFIX}:${moduleName}`;
}

export function createSequenceErrorHandlerToken(moduleName: string): string {
  return `${SEQUENCE_ERROR_HANDLER_PREFIX}:${moduleName}`;
}

export function createSequenceSuccessHandlerToken(moduleName: string): string {
  return `${SEQUENCE_SUCCESS_HANDLER_PREFIX}:${moduleName}`;
}

export function createSequenceStartTaskHandlerToken(
  moduleName: string,
): string {
  return `${SEQUENCE_START_TASK_HANDLER_PREFIX}:${moduleName}`;
}
