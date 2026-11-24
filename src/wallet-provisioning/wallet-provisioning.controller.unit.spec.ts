import { User } from '../database/entities/user.entity';
import { WalletProvisioningController } from './wallet-provisioning.controller';
import { WalletProvisioningService } from './wallet-provisioning.service';

describe('WalletProvisioningController', () => {
  const user = { id: 1, uuid: 'user-uuid' } as User;
  let service: jest.Mocked<
    Pick<WalletProvisioningService, 'getApplePayData' | 'getGooglePayData'>
  >;
  let controller: WalletProvisioningController;

  beforeEach(() => {
    service = {
      getApplePayData: jest.fn().mockResolvedValue({
        activationData: 'A',
        encryptedPassData: 'E',
        ephemeralPublicKey: 'K',
      }),
      getGooglePayData: jest
        .fn()
        .mockResolvedValue({ opc: 'OPC', googleOpc: 'GOPC' }),
    };
    controller = new WalletProvisioningController(
      service as unknown as WalletProvisioningService,
    );
  });

  it('asks for Apple Pay data as the signed-in user, by uuid', async () => {
    const body = {
      certificates: ['Q0VSVA=='],
      nonce: 'Tk9OQ0U=',
      nonceSignature: 'U0lH',
    };
    await expect(controller.applePay(body, user)).resolves.toEqual({
      activationData: 'A',
      encryptedPassData: 'E',
      ephemeralPublicKey: 'K',
    });
    expect(service.getApplePayData).toHaveBeenCalledWith('user-uuid', body);
  });

  it('asks for Google Pay data as the signed-in user, by uuid', async () => {
    await expect(
      controller.googlePay({ serverSessionId: 'SID', cardId: 'c' }, user),
    ).resolves.toEqual({
      opc: 'OPC',
      googleOpc: 'GOPC',
    });
    expect(service.getGooglePayData).toHaveBeenCalledWith('user-uuid', {
      serverSessionId: 'SID',
      cardId: 'c',
    });
  });
});
