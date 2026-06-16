import Joi from 'joi';
import { configSources as from } from '../../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../../config-provider/abstract/define-config-scope.util';

export type ExpoScopeConfig = {
  accessToken: string;
};

const schema = Joi.object<ExpoScopeConfig>({
  accessToken: Joi.string().optional().default(''),
});

export const expoScope = defineConfigScope<ExpoScopeConfig>(
  'expo',
  {
    accessToken: from.env('EXPO_ACCESS_TOKEN'),
  },
  (raw) => {
    const { error, value } = schema.validate(raw, { abortEarly: false });
    if (error) throw new Error(error.message);
    return value;
  },
);
