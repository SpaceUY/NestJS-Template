import * as Joi from 'joi';
import { configSources as from } from '../../config-provider/abstract/config-source.util';
import { defineConfigScope } from '../../config-provider/abstract/define-config-scope.util';

export type WalletProvisioningScopeConfig = {
  // Repeated provisioning requests this close together share one REQUESTED row.
  requestDedupeSeconds: number;
  // A webhook can claim a REQUESTED row opened by the app this recently.
  claimWindowMinutes: number;
};

// A blank variable (as copied from .env.example) counts as unset.
const schema = Joi.object<WalletProvisioningScopeConfig>({
  requestDedupeSeconds: Joi.number().integer().positive().empty('').default(60),
  claimWindowMinutes: Joi.number().integer().positive().empty('').default(30),
});

export const walletProvisioningScope =
  defineConfigScope<WalletProvisioningScopeConfig>(
    'walletProvisioning',
    {
      requestDedupeSeconds: from.env('WALLET_PROVISIONING_DEDUPE_SECONDS'),
      claimWindowMinutes: from.env('WALLET_PROVISIONING_CLAIM_WINDOW_MINUTES'),
    },
    (raw) => {
      const { error, value } = schema.validate(raw, { abortEarly: false });
      if (error) throw new Error(error.message);
      return value;
    },
  );
