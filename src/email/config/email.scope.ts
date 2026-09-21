import * as Joi from 'joi';
import { configSources as from } from '../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../config-provider/abstract/define-config-scope.util';

export const EMAIL_ADAPTERS = {
  AWS_SES: 'AWS_SES',
  SENDGRID: 'SENDGRID',
  RESEND: 'RESEND',
  CONSOLE: 'CONSOLE',
} as const;

type EmailAdapter = (typeof EMAIL_ADAPTERS)[keyof typeof EMAIL_ADAPTERS];

/**
 * The adapters that hand a message to a provider. `CONSOLE` is deliberately
 * absent: it only prints what it would have sent, so it needs neither a
 * credential nor a real sender address.
 */
const SENDING_ADAPTERS: readonly EmailAdapter[] = [
  EMAIL_ADAPTERS.AWS_SES,
  EMAIL_ADAPTERS.SENDGRID,
  EMAIL_ADAPTERS.RESEND,
];

export type EmailScopeConfig = {
  adapter: string;
  from: string;
  sendgridApiKey: string;
  resendApiKey: string;
  resendEmailFrom?: string;
  sesRegion: string;
  sesAccessKeyId: string;
  sesSecretAccessKey: string;
};

/**
 * Matches only when the selected adapter is one that really sends. Written as
 * an explicit `.required()` schema so an absent `EMAIL_ADAPTER` never matches.
 * @returns {Joi.StringSchema} The condition schema for a `when` clause.
 */
const isSendingAdapter = (): Joi.StringSchema =>
  Joi.string()
    .valid(...SENDING_ADAPTERS)
    .required();

/**
 * A provider credential: required and non-empty exactly when its own adapter is
 * the selected one, inert otherwise so the other providers' variables may stay
 * unset. Joi's own message would name the config field (`sendgridApiKey`),
 * which is not what an operator sets — these name the environment variable and
 * the adapter that made it mandatory, so the boot failure says what to fix.
 * @param {EmailAdapter} adapter The adapter this credential belongs to.
 * @param {string} envVar The environment variable that supplies it.
 * @returns {Joi.StringSchema} The conditional schema for that credential.
 */
const credentialFor = (
  adapter: EmailAdapter,
  envVar: string,
): Joi.StringSchema => {
  const missing = `${envVar} is required when EMAIL_ADAPTER=${adapter}`;

  return Joi.string().when('adapter', {
    is: Joi.string().valid(adapter).required(),
    then: Joi.string().required().messages({
      'any.required': missing,
      'string.base': missing,
      'string.empty': missing,
    }),
    otherwise: Joi.string().allow('').optional().default(''),
  });
};

const MISSING_FROM =
  'EMAIL_FROM is required when EMAIL_ADAPTER is AWS_SES, SENDGRID or RESEND — it is the sender address the provider is given';

const validate = (raw: Record<string, unknown>): EmailScopeConfig => {
  const schema = Joi.object<EmailScopeConfig>({
    adapter: Joi.string()
      .valid(...Object.values(EMAIL_ADAPTERS))
      .default(EMAIL_ADAPTERS.CONSOLE)
      .messages({
        'any.only': `EMAIL_ADAPTER must be one of ${Object.values(
          EMAIL_ADAPTERS,
        ).join(', ')}`,
      }),
    // No default sender. A plausible-looking literal here is the `C2` shape:
    // a misconfigured deploy would send from it instead of refusing to boot.
    // Under CONSOLE the value stays '', which ConsoleAdapterService reads as
    // "no default sender" — nothing is delivered from it either way.
    from: Joi.string().when('adapter', {
      is: isSendingAdapter(),
      then: Joi.string().email().required().messages({
        'any.required': MISSING_FROM,
        'string.base': MISSING_FROM,
        'string.empty': MISSING_FROM,
        'string.email': 'EMAIL_FROM must be a valid email address',
      }),
      otherwise: Joi.string().email().allow('').optional().default(''),
    }),
    sendgridApiKey: credentialFor(EMAIL_ADAPTERS.SENDGRID, 'SENDGRID_API_KEY'),
    resendApiKey: credentialFor(EMAIL_ADAPTERS.RESEND, 'RESEND_API_KEY'),
    // An optional override of EMAIL_FROM for Resend only. It carries no
    // default: '' was one the schema itself rejects, since Joi never validates
    // its own defaults.
    resendEmailFrom: Joi.string().email().allow('').optional().messages({
      'string.email':
        'RESEND_EMAIL_FROM must be a valid email address when set; leave it unset to send from EMAIL_FROM',
    }),
    sesRegion: credentialFor(EMAIL_ADAPTERS.AWS_SES, 'AWS_SES_REGION'),
    sesAccessKeyId: credentialFor(EMAIL_ADAPTERS.AWS_SES, 'AWS_ACCESS_KEY'),
    sesSecretAccessKey: credentialFor(
      EMAIL_ADAPTERS.AWS_SES,
      'AWS_SECRET_ACCESS_KEY',
    ),
  });

  const { error, value } = schema.validate(raw, { abortEarly: false });
  if (error) throw new Error(error.message);
  return value;
};

export const emailScope = defineConfigScope<EmailScopeConfig>(
  'email',
  {
    adapter: from.env('EMAIL_ADAPTER'),
    from: from.env('EMAIL_FROM'),
    sendgridApiKey: from.env('SENDGRID_API_KEY'),
    resendApiKey: from.env('RESEND_API_KEY'),
    resendEmailFrom: from.env('RESEND_EMAIL_FROM'),
    sesRegion: from.env('AWS_SES_REGION'),
    sesAccessKeyId: from.env('AWS_ACCESS_KEY'),
    sesSecretAccessKey: from.env('AWS_SECRET_ACCESS_KEY'),
  },
  validate,
);
