import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export interface Auth0Config {
  domain: string;
  audience: string;
  issuer: string;
  jwksUri: string;
}

export default registerAs('auth0', (): Auth0Config => {
  const config = {
    domain: process.env.AUTH0_DOMAIN,
    audience: process.env.AUTH0_AUDIENCE,
    issuer: process.env.AUTH0_ISSUER,
    jwksUri: process.env.AUTH0_JWKS_URI,
  };

  const schema = Joi.object<Auth0Config>({
    domain: Joi.string().required(),
    audience: Joi.string().required(),
    issuer: Joi.string().uri().required(),
    jwksUri: Joi.string().uri().required(),
  });

  const { error, value } = schema.validate(config);

  if (error) {
    throw new Error(`Auth0 config validation error: ${error.message}`);
  }

  return value;
});
