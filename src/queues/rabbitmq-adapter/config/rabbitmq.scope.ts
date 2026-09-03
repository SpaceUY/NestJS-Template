import * as Joi from 'joi';
import { configSources as from } from '../../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../../config-provider/abstract/define-config-scope.util';

export type RabbitmqScopeConfig = {
  url: string;
};

const schema = Joi.object<RabbitmqScopeConfig>({
  url: Joi.string().default('amqp://localhost:5672'),
});

export const rabbitmqScope = defineConfigScope<RabbitmqScopeConfig>(
  'rabbitmq',
  {
    url: from.env('RABBITMQ_URL'),
  },
  (raw) => {
    const { error, value } = schema.validate(raw, { abortEarly: false });
    if (error) throw new Error(error.message);
    return value;
  },
);
