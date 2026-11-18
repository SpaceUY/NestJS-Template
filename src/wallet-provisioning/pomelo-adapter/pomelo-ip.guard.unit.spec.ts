import { ExecutionContext } from '@nestjs/common';
import { PomeloIpGuard } from './pomelo-ip.guard';

const contextFor = (ip: string | undefined): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ ip }) }),
  }) as unknown as ExecutionContext;

describe('PomeloIpGuard', () => {
  it('allows any IP when the list is empty', () => {
    expect(
      new PomeloIpGuard({ allowedIps: [] } as never).canActivate(
        contextFor('9.9.9.9'),
      ),
    ).toBe(true);
  });

  it('allows a listed IP, also in its IPv4-mapped IPv6 form', () => {
    const guard = new PomeloIpGuard({ allowedIps: ['1.2.3.4'] } as never);
    expect(guard.canActivate(contextFor('1.2.3.4'))).toBe(true);
    expect(guard.canActivate(contextFor('::ffff:1.2.3.4'))).toBe(true);
  });

  it('rejects an IP outside the list, or an unknown one', () => {
    const guard = new PomeloIpGuard({ allowedIps: ['1.2.3.4'] } as never);
    expect(guard.canActivate(contextFor('5.6.7.8'))).toBe(false);
    expect(guard.canActivate(contextFor(undefined))).toBe(false);
  });
});
