import { TokenizationProvider } from '../tokenization-provider';

export class MockTokenizationProvider extends TokenizationProvider {
  getApplePayData = jest.fn().mockResolvedValue({
    activationData: 'QUNU',
    encryptedPassData: 'RU5D',
    ephemeralPublicKey: 'RVBL',
  });

  getGooglePayData = jest
    .fn()
    .mockResolvedValue({ opc: 'OPC', googleOpc: 'GOPC' });
}
