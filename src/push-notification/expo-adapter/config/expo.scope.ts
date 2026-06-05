import Joi = require('joi');
import { configSources as from } from '../../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../../config-provider/abstract/define-config-scope.util';

export type ExpoScopeConfig = {
  accessToken: string;
};

export const expoScope = defineConfigScope<ExpoScopeConfig>(
  'expo',
  {
    accessToken: from.env('EXPO_ACCESS_TOKEN'),
  },
  Joi.object<ExpoScopeConfig>({
    accessToken: Joi.string().optional().default(''),
  }),
);
