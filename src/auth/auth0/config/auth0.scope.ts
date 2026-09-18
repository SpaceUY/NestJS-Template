import * as Joi from 'joi';
import { configSources as from } from '../../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../../config-provider/abstract/define-config-scope.util';

export type Auth0ScopeConfig = {
  enabled: boolean;
  domain: string;
  audience: string;
  issuer: string;
  jwksUri: string;
};

const schema = Joi.object({
  enabled: Joi.boolean().default(false),
  domain: Joi.string().when('enabled', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  audience: Joi.string().when('enabled', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  issuer: Joi.string().optional(),
  jwksUri: Joi.string().optional(),
}).custom((value) => {
  if (!value.issuer && value.domain) {
    value.issuer = `https://${value.domain}/`;
  }
  if (!value.jwksUri && value.domain) {
    value.jwksUri = `https://${value.domain}/.well-known/jwks.json`;
  }
  return value;
});

export const auth0Scope = defineConfigScope<Auth0ScopeConfig>(
  'auth0',
  {
    enabled: from.env('AUTH0_ENABLED'),
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
