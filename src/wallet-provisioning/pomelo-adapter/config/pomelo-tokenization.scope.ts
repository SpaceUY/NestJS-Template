import * as Joi from 'joi';
import { configSources as from } from '../../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../../config-provider/abstract/define-config-scope.util';

export type PomeloTokenizationScopeConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  // Base64; the same secret Pomelo signs the transaction webhooks with.
  webhookApiSecret: string;
  // Empty: no IP check (the signature still applies).
  allowedIps: string[];
  // Below 7 s: the app gives up at 8 s and Google Wallet at 10 s.
  requestTimeoutMs: number;
  mastercardApplePayPath: string;
  mastercardGooglePayPath: string;
  // From Pomelo's annex; to confirm with Pomelo before using Visa.
  visaApplePayPath: string;
  // Unknown until Pomelo confirms it: Visa on Google Pay is rejected while unset.
  visaGooglePayPath?: string;
};

const ipList = Joi.alternatives()
  .try(
    Joi.array().items(Joi.string().ip()),
    Joi.string()
      .allow('')
      .custom((value: string) =>
        value
          .split(',')
          .map((ip) => ip.trim())
          .filter(Boolean),
      ),
  )
  .default([]);

const schema = Joi.object<PomeloTokenizationScopeConfig>({
  baseUrl: Joi.string()
    .uri({ scheme: ['https', 'http'] })
    .required(),
  clientId: Joi.string().required(),
  clientSecret: Joi.string().required(),
  audience: Joi.string().required(),
  webhookApiSecret: Joi.string().base64().required(),
  allowedIps: ipList,
  requestTimeoutMs: Joi.number().integer().positive().less(7000).default(6500),
  mastercardApplePayPath: Joi.string().default(
    '/token-provisioning/mastercard/apple-pay',
  ),
  mastercardGooglePayPath: Joi.string().default(
    '/token-provisioning/v2/mastercard/google-pay',
  ),
  visaApplePayPath: Joi.string().default(
    '/token-provisioning/v2/visa/apple-pay',
  ),
  visaGooglePayPath: Joi.string().optional(),
});

export const pomeloTokenizationScope =
  defineConfigScope<PomeloTokenizationScopeConfig>(
    'pomeloTokenization',
    {
      baseUrl: from.env('POMELO_BASE_URL'),
      clientId: from.env('POMELO_CLIENT_ID'),
      clientSecret: from.env('POMELO_CLIENT_SECRET'),
      audience: from.env('POMELO_AUDIENCE'),
      webhookApiSecret: from.env('POMELO_WEBHOOK_API_SECRET'),
      allowedIps: from.env('POMELO_ALLOWED_IPS'),
      requestTimeoutMs: from.env('POMELO_REQUEST_TIMEOUT_MS'),
      mastercardApplePayPath: from.env('POMELO_MASTERCARD_APPLE_PAY_PATH'),
      mastercardGooglePayPath: from.env('POMELO_MASTERCARD_GOOGLE_PAY_PATH'),
      visaApplePayPath: from.env('POMELO_VISA_APPLE_PAY_PATH'),
      visaGooglePayPath: from.env('POMELO_VISA_GOOGLE_PAY_PATH'),
    },
    (raw) => {
      const { error, value } = schema.validate(raw, { abortEarly: false });
      if (error) throw new Error(error.message);
      return value;
    },
  );
