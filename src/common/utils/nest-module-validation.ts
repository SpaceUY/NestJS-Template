import type { DynamicModule, ForwardReference, Type } from '@nestjs/common';

export type AdapterModuleLike =
  | Type<unknown>
  | DynamicModule
  | Promise<DynamicModule>
  | ForwardReference;

export function validateAdapterModule(
  adapter: AdapterModuleLike,
  featureName = 'Module',
): void {
  const isPromiseLike = (val: unknown): val is Promise<unknown> =>
    !!val && typeof (val as { then?: unknown }).then === 'function';

  const isForwardRef = (val: unknown): boolean =>
    !!val && typeof (val as { forwardRef?: unknown }).forwardRef === 'function';

  const isDynamicModule = (val: unknown): val is DynamicModule =>
    !!val &&
    typeof val === 'object' &&
    val !== null &&
    'module' in (val as object);

  const isType = (val: unknown): val is Type<unknown> =>
    typeof val === 'function';

  const adapterName = (() => {
    if (isType(adapter))
      return (adapter as { name?: string }).name || 'AnonymousClass';
    if (isDynamicModule(adapter)) {
      const mod = adapter as { module?: { name?: string } };
      return (mod.module && mod.module.name) || 'DynamicModule';
    }
    if (isForwardRef(adapter)) return 'ForwardRef';
    if (isPromiseLike(adapter)) return 'Promise<DynamicModule>';
    return 'UnknownAdapter';
  })();

  const valid =
    isType(adapter) ||
    isDynamicModule(adapter) ||
    isForwardRef(adapter) ||
    isPromiseLike(adapter);

  if (!valid) {
    throw new Error(
      `Invalid adapter provided to ${featureName}: ${adapterName}. ` +
        'Expected a Nest module class, DynamicModule, forwardRef wrapper, or a Promise resolving to a DynamicModule.',
    );
  }
}
