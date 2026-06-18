import * as Joi from 'joi';
import { configSources as from } from '../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../config-provider/abstract/define-config-scope.util';

export type Auth0ScopeConfig = {
  domain: string;
  audience: string;
  issuer: string;
  jwksUri: string;
};

const schema = Joi.object<Auth0ScopeConfig>({
  domain: Joi.string().required(),
  audience: Joi.string().required(),
  issuer: Joi.string().uri().required(),
  jwksUri: Joi.string().uri().required(),
});

export const auth0Scope = defineConfigScope<Auth0ScopeConfig>(
  'auth0',
  {
    domain: from.env('AUTH0_DOMAIN'),
    audience: from.env('AUTH0_AUDIENCE'),
    issuer: from.env('AUTH0_ISSUER'),
    jwksUri: from.env('AUTH0_JWKS_URI'),
  },
  (raw) => {
    const { error, value } = schema.validate(raw, { abortEarly: false });
    if (error) throw new Error(error.message);
    return value;
  },
);
