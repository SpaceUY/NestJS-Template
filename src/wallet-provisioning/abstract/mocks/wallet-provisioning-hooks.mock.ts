import { WalletProvisioningHooks } from '../wallet-provisioning-hooks';

export class MockWalletProvisioningHooks extends WalletProvisioningHooks {
  onProvisioningAbandoned = jest.fn().mockResolvedValue(undefined);
}
