import Joi from 'joi';
import { configSources as from } from '../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../config-provider/abstract/define-config-scope.util';

export type DatabaseScopeConfig = {
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  synchronize: boolean;
  logging: boolean;
};

const schema = Joi.object<DatabaseScopeConfig>({
  url: Joi.string().optional(),
  host: Joi.string().optional(),
  port: Joi.number().integer().optional(),
  username: Joi.string().optional(),
  password: Joi.string().optional(),
  database: Joi.string().optional(),
  synchronize: Joi.boolean().default(false),
  logging: Joi.boolean().default(true),
});

export const databaseScope = defineConfigScope<DatabaseScopeConfig>(
  'database',
  {
    url: from.env('DATABASE_URL'),
    host: from.env('DB_HOST'),
    port: from.env('DB_PORT'),
    username: from.env('DB_USER'),
    password: from.env('DB_PASS'),
    database: from.env('DB_NAME'),
    synchronize: from.env('DB_SYNCHRONIZE'),
    logging: from.env('DB_LOGGING'),
  },
  (raw) => {
    const { error, value } = schema.validate(raw, { abortEarly: false });
    if (error) throw new Error(error.message);
    return value;
  },
);
