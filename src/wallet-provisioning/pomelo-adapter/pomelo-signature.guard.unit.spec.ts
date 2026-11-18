import { ExecutionContext } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PomeloSignatureGuard } from './pomelo-signature.guard';

const SECRET = Buffer.from('a-webhook-secret').toString('base64');
const rawBody = Buffer.from('{"card_id":"crd-1"}');

// Pomelo signs timestamp + endpoint + raw body with HMAC-SHA256 under the base64-decoded secret.
const sign = (timestamp: string, endpoint: string, body: Buffer): string =>
  `hmac-sha256 ${createHmac('sha256', Buffer.from(SECRET, 'base64')).update(timestamp).update(endpoint).update(body).digest('base64')}`;

const contextWith = (
  headers: Record<string, string>,
  body: Buffer | null = rawBody,
): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers, rawBody: body ?? undefined }),
    }),
  }) as unknown as ExecutionContext;

describe('PomeloSignatureGuard', () => {
  const guard = new PomeloSignatureGuard({ webhookApiSecret: SECRET } as never);
  const headers = {
    'x-timestamp': '1700000000',
    'x-endpoint': '/wallet-provisioning/webhooks/pomelo/token-lifecycle',
  };

  it('accepts a valid signature', () => {
    const signature = sign(
      headers['x-timestamp'],
      headers['x-endpoint'],
      rawBody,
    );
    expect(
      guard.canActivate(contextWith({ ...headers, 'x-signature': signature })),
    ).toBe(true);
  });

  it('rejects a wrong signature', () => {
    const signature = sign(
      headers['x-timestamp'],
      headers['x-endpoint'],
      Buffer.from('{"card_id":"other"}'),
    );
    expect(
      guard.canActivate(contextWith({ ...headers, 'x-signature': signature })),
    ).toBe(false);
    expect(
      guard.canActivate(
        contextWith({ ...headers, 'x-signature': 'hmac-sha256 short' }),
      ),
    ).toBe(false);
  });

  it('rejects missing headers', () => {
    expect(
      guard.canActivate(
        contextWith({ 'x-timestamp': '1', 'x-endpoint': '/x' }),
      ),
    ).toBe(false);
    expect(guard.canActivate(contextWith({}))).toBe(false);
  });

  it('rejects a request without a raw body', () => {
    const signature = sign(
      headers['x-timestamp'],
      headers['x-endpoint'],
      rawBody,
    );
    expect(
      guard.canActivate(
        contextWith({ ...headers, 'x-signature': signature }, null),
      ),
    ).toBe(false);
  });
});
