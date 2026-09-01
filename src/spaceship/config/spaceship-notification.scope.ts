import * as Joi from 'joi';
import { configSources as from } from '../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../config-provider/abstract/define-config-scope.util';

export type SpaceshipNotificationScopeConfig = {
  employeeEmails: string[];
};

const schema = Joi.object<SpaceshipNotificationScopeConfig>({
  employeeEmails: Joi.array().items(Joi.string().email()).default([]),
});

export const spaceshipNotificationScope =
  defineConfigScope<SpaceshipNotificationScopeConfig>(
    'spaceshipNotification',
    {
      employeeEmails: from.env('NOTIFICATION_EMPLOYEE_EMAILS'),
    },
    (raw) => {
      const parsedRaw = {
        employeeEmails:
          typeof raw.employeeEmails === 'string' &&
          raw.employeeEmails.length > 0
            ? raw.employeeEmails
                .split(',')
                .map((email) => email.trim())
                .filter(Boolean)
            : [],
      };

      const { error, value } = schema.validate(parsedRaw, {
        abortEarly: false,
      });
      if (error) throw new Error(error.message);
      return value;
    },
  );
