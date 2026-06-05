import Joi = require('joi');
import { configSources as from } from '../../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../../config-provider/abstract/define-config-scope.util';

export type GoogleScopeConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  audience: string;
  callbackUrl: string;
  selfUrl: string;
};

export const googleScope = defineConfigScope<GoogleScopeConfig>(
  'google',
  {
    enabled: from.env('GOOGLE_OAUTH_ENABLED'),
    clientId: from.env('GOOGLE_OAUTH_CLIENT_ID'),
    clientSecret: from.env('GOOGLE_OAUTH_CLIENT_SECRET'),
    audience: from.env('GOOGLE_OAUTH_AUDIENCE'),
    callbackUrl: from.env('GOOGLE_OAUTH_CALLBACK_URL'),
    selfUrl: from.env('SELF_URL'),
  },
  Joi.object({
    enabled: Joi.boolean().default(false),
    clientId: Joi.string().when('enabled', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    clientSecret: Joi.string().when('enabled', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    audience: Joi.string().when('enabled', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    callbackUrl: Joi.string().optional(),
    selfUrl: Joi.string().default('http://localhost:5000'),
  }).custom((value) => {
    if (!value.callbackUrl) {
      value.callbackUrl = `${value.selfUrl}/auth/google/callback`;
    }
    return value;
  }),
);
