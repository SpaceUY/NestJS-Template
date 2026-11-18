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

type SignedRequest = {
  headers: Record<string, string | undefined>;
  rawBody?: Buffer;
};

/**
 * Pomelo signs each webhook: HMAC-SHA256 of timestamp + endpoint + raw body, keyed with the
 * base64-decoded API secret, sent as `x-signature: hmac-sha256 <base64>`. Needs the raw body
 * (`rawBody: true` in NestFactory.create).
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
