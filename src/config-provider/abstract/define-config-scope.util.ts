import Joi = require('joi');
import { ConfigScopeDefinition, ConfigScopeFieldMapping } from './config-provider.interfaces';

export function defineConfigScope<T extends object>(
  name: string,
  fields: Record<keyof T & string, ConfigScopeFieldMapping>,
  schema?: Joi.ObjectSchema<T>,
): ConfigScopeDefinition<T> {
  return {
    KEY: `CONFIG_SCOPE_${name.toUpperCase()}`,
    name,
    fields,
    schema,
  };
}
