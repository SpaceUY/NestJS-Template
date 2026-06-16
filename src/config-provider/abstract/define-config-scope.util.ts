import {
  ConfigScopeDefinition,
  ConfigScopeFieldMapping,
} from './config-provider.interfaces';

export function defineConfigScope<T extends object>(
  name: string,
  fields: Record<keyof T & string, ConfigScopeFieldMapping>,
  validate?: (raw: Record<string, unknown>) => T,
  options?: { live?: boolean },
): ConfigScopeDefinition<T> {
  return {
    KEY: `CONFIG_SCOPE_${name.toUpperCase()}`,
    name,
    fields,
    validate,
    live: options?.live,
  };
}
