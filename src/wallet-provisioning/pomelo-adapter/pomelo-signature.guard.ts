import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  pomeloTokenizationScope,
  PomeloTokenizationScopeConfig,
} from './config/pomelo-tokenization.scope';

// A signed event replayed after this window is rejected, so a captured webhook cannot be resent.
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

type SignedRequest = {
  headers: Record<string, string | undefined>;
  rawBody?: Buffer;
};

/**
 * Pomelo signs each webhook: HMAC-SHA256 of timestamp + endpoint + raw body, keyed with the
 * base64-decoded API secret, sent as `x-signature: hmac-sha256 <base64>`. Needs the raw body
 * (`rawBody: true` in NestFactory.create). `x-timestamp` (unix seconds) must be within five
 * minutes of now.
 */
@Injectable()
export class PomeloSignatureGuard implements CanActivate {
  constructor(
    @Inject(pomeloTokenizationScope.KEY)
    private readonly config: PomeloTokenizationScopeConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<SignedRequest>();
    const signature = request.headers['x-signature'];
    const timestamp = request.headers['x-timestamp'];
    const endpoint = request.headers['x-endpoint'];
    if (!signature || !timestamp || !endpoint || !request.rawBody) return false;
    if (!isFresh(timestamp)) return false;

    const digest = createHmac(
      'sha256',
      Buffer.from(this.config.webhookApiSecret, 'base64'),
    )
      .update(timestamp)
      .update(endpoint)
      .update(request.rawBody)
      .digest('base64');
    const expected = Buffer.from(`hmac-sha256 ${digest}`);
    const received = Buffer.from(signature);
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  }
}

function isFresh(timestamp: string): boolean {
  if (!/^\d+$/.test(timestamp)) return false;
  return Math.abs(Date.now() - Number(timestamp) * 1000) <= MAX_CLOCK_SKEW_MS;
}
