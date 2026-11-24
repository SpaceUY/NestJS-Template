import { HttpStatus } from '@nestjs/common';
import { ExceptionInfo } from '../common/exception/core/ExceptionBase';

// The module owns its error descriptors (invariant `T3`). The app shows its own text for each
// code; these messages never carry processor details.
export const WalletProvisioningExceptions = {
  cardNotEligible: (): ExceptionInfo => ({
    httpStatus: HttpStatus.BAD_REQUEST,
    errorCode: 'WALLET_CARD_NOT_ELIGIBLE',
    errorMsg: 'The card cannot be added to a wallet',
  }),
  providerUnavailable: (): ExceptionInfo => ({
    httpStatus: HttpStatus.BAD_GATEWAY,
    errorCode: 'WALLET_PROVIDER_UNAVAILABLE',
    errorMsg: 'The card could not be added to the wallet. Try again later',
  }),
};
