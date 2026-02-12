import { createLevelLogger } from '../../common/logger/adapters/level-logger.adapter';
import type { EmailLogger } from '../abstract/email-logger.interface';

export function createDefaultEmailLogger(): EmailLogger {
  const lvl = createLevelLogger('EmailModule');
  return {
    debug: lvl.debug?.bind(lvl),
    info: lvl.info?.bind(lvl),
    warn: lvl.warn?.bind(lvl),
    error: lvl.error?.bind(lvl),
  };
}
