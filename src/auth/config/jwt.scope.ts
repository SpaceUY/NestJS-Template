import Joi from 'joi';
import { configSources as from } from '../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../config-provider/abstract/define-config-scope.util';

export type JwtScopeConfig = {
  secret: string;
  expiresIn: string;
  ignoreExpiration: boolean;
};

const schema = Joi.object<JwtScopeConfig>({
  secret: Joi.string().default('Not A Safe Secret'),
  expiresIn: Joi.string().default('7d'),
  ignoreExpiration: Joi.boolean().default(false),
});

export const jwtScope = defineConfigScope<JwtScopeConfig>(
  'jwt',
  {
    secret: from.env('JWT_SECRET'),
    expiresIn: from.env('JWT_EXPIRES_IN'),
    ignoreExpiration: from.env('JWT_IGNORE_EXPIRATION'),
  },
  (raw) => {
    const { error, value } = schema.validate(raw, { abortEarly: false });
    if (error) throw new Error(error.message);
    return value;
  },
);
