import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ApplePayRequestDto } from './apple-pay-request.dto';
import { GooglePayRequestDto } from './google-pay-request.dto';

const errorsOf = async (
  cls: new () => object,
  body: object,
): Promise<string[]> =>
  (await validate(plainToInstance(cls, body))).map((error) => error.property);

const apple = {
  certificates: ['Q0VSVA=='],
  nonce: 'Tk9OQ0U=',
  nonceSignature: 'U0lH',
};

describe('wallet provisioning DTOs', () => {
  it('accepts a valid Apple Pay request with and without cardId', async () => {
    expect(await errorsOf(ApplePayRequestDto, apple)).toEqual([]);
    expect(
      await errorsOf(ApplePayRequestDto, {
        ...apple,
        cardId: '3f2b8c1e-6c1d-4a7e-9d2a-1b2c3d4e5f60',
      }),
    ).toEqual([]);
  });

  it('rejects a non-base64 certificate', async () => {
    expect(
      await errorsOf(ApplePayRequestDto, {
        ...apple,
        certificates: ['not base64!'],
      }),
    ).toEqual(['certificates']);
  });

  it('rejects an empty certificate list and a missing nonce', async () => {
    expect(
      await errorsOf(ApplePayRequestDto, {
        ...apple,
        certificates: [],
        nonce: undefined,
      }),
    ).toEqual(expect.arrayContaining(['certificates', 'nonce']));
  });

  it('rejects a cardId that is not a uuid', async () => {
    expect(
      await errorsOf(ApplePayRequestDto, { ...apple, cardId: '42' }),
    ).toEqual(['cardId']);
  });

  it('rejects an empty serverSessionId', async () => {
    expect(
      await errorsOf(GooglePayRequestDto, { serverSessionId: '' }),
    ).toEqual(['serverSessionId']);
  });

  it('rejects a serverSessionId longer than 512 characters', async () => {
    expect(
      await errorsOf(GooglePayRequestDto, { serverSessionId: 'a'.repeat(513) }),
    ).toEqual(['serverSessionId']);
  });
});
