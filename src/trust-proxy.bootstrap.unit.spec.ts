import { createDeferredTrustProxy } from './trust-proxy.bootstrap';

describe('createDeferredTrustProxy', () => {
  it('trusts nothing until a value is applied', () => {
    const { trust } = createDeferredTrustProxy();

    expect(trust('10.0.0.1', 0)).toBe(false);
  });

  it('trusts every hop for true and none for false', () => {
    const open = createDeferredTrustProxy();
    open.apply(true);
    const closed = createDeferredTrustProxy();
    closed.apply(false);

    expect(open.trust('203.0.113.9', 5)).toBe(true);
    expect(closed.trust('10.0.0.1', 0)).toBe(false);
  });

  it('treats a number as a hop count, as Express did', () => {
    const { trust, apply } = createDeferredTrustProxy();
    apply(1);

    expect(trust('10.0.0.1', 0)).toBe(true);
    expect(trust('10.0.0.2', 1)).toBe(false);
  });

  it('trusts no hop for a count of zero', () => {
    const { trust, apply } = createDeferredTrustProxy();
    apply(0);

    expect(trust('10.0.0.1', 0)).toBe(false);
  });

  it('trusts only the addresses and ranges in a list', () => {
    const { trust, apply } = createDeferredTrustProxy();
    apply('loopback, 10.0.0.0/8');

    expect(trust('127.0.0.1', 0)).toBe(true);
    expect(trust('10.1.2.3', 0)).toBe(true);
    expect(trust('203.0.113.9', 0)).toBe(false);
  });

  it('follows the latest applied value', () => {
    const { trust, apply } = createDeferredTrustProxy();
    apply(true);
    apply(false);

    expect(trust('10.0.0.1', 0)).toBe(false);
  });
});
