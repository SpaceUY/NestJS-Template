import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  pomeloTokenizationScope,
  PomeloTokenizationScopeConfig,
} from './config/pomelo-tokenization.scope';

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/;

/**
 * Optional allowlist of Pomelo's webhook IPs. Reads `request.ip`, which follows the app's
 * `TRUST_PROXY` setting, so behind a load balancer configure that rather than trusting
 * X-Forwarded-For here.
 */
@Injectable()
export class PomeloIpGuard implements CanActivate {
  constructor(
    @Inject(pomeloTokenizationScope.KEY)
    private readonly config: PomeloTokenizationScopeConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.allowedIps.length === 0) return true;
    const ip = context.switchToHttp().getRequest<{ ip?: string }>().ip;
    if (!ip) return false;
    const normalized = IPV4_MAPPED.exec(ip)?.[1] ?? ip;
    return this.config.allowedIps.includes(normalized);
  }
}
