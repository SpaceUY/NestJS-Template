import * as Joi from 'joi';
import { configSources as from } from '../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../config-provider/abstract/define-config-scope.util';

export type SpaceshipCacheScopeConfig = {
  listTtlSeconds: number;
};

const schema = Joi.object<SpaceshipCacheScopeConfig>({
  listTtlSeconds: Joi.number().integer().positive().default(60),
});

export const spaceshipCacheScope = defineConfigScope<SpaceshipCacheScopeConfig>(
  'spaceshipCache',
  {
    listTtlSeconds: from.env('SPACESHIP_LIST_CACHE_TTL_SECONDS'),
  },
  (raw) => {
    const { error, value } = schema.validate(raw, { abortEarly: false });
    if (error) throw new Error(error.message);
    return value;
  },
);
