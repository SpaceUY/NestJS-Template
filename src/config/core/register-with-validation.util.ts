import {
  ConfigFactory,
  ConfigFactoryKeyHost,
  ConfigObject,
  getConfigToken,
} from '@nestjs/config';
import {
  PARTIAL_CONFIGURATION_KEY,
  PARTIAL_CONFIGURATION_PROPNAME,
} from '@nestjs/config/dist/config.constants';
import Joi = require('joi');

export type ConfigValidation = { VALIDATION: Record<string, Joi.AnySchema> };

export default function registerWithValidation<
  TConfig extends ConfigObject,
  TFactory extends ConfigFactory = ConfigFactory<TConfig>,
>(
  token: string,
  configFactory: TFactory,
  validation: Record<string, Joi.AnySchema>,
): TFactory & ConfigFactoryKeyHost & ConfigValidation {
  Object.defineProperty(configFactory, PARTIAL_CONFIGURATION_KEY, {
    configurable: false,
    enumerable: false,
    value: token,
    writable: false,
  });
  Object.defineProperty(configFactory, PARTIAL_CONFIGURATION_PROPNAME, {
    configurable: false,
    enumerable: false,
    value: getConfigToken(token),
    writable: false,
  });
  Object.defineProperty(configFactory, 'VALIDATION', {
    configurable: false,
    enumerable: false,
    value: validation,
    writable: false,
  });

  return configFactory as TFactory & ConfigFactoryKeyHost & ConfigValidation;
}
