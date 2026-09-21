import { forwardRef, Module } from '@nestjs/common';
import {
  AdapterModuleLike,
  validateAdapterModule,
} from './nest-module-validation';

@Module({})
class SomeAdapterModule {}

describe('validateAdapterModule', () => {
  it.each([
    ['a module class', SomeAdapterModule],
    ['a DynamicModule', { module: SomeAdapterModule }],
    ['a forwardRef wrapper', forwardRef(() => SomeAdapterModule)],
    [
      'a promise of a DynamicModule',
      Promise.resolve({ module: SomeAdapterModule }),
    ],
  ])('accepts %s', (_, adapter) => {
    expect(() =>
      validateAdapterModule(adapter as AdapterModuleLike),
    ).not.toThrow();
  });

  it.each([
    ['a string', 'SomeAdapterModule'],
    ['a number', 42],
    ['a plain object with no module key', { adapter: SomeAdapterModule }],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s', (_, adapter) => {
    expect(() =>
      validateAdapterModule(adapter as unknown as AdapterModuleLike),
    ).toThrow(/Invalid adapter provided to Module/);
  });

  it('names the caller so the failure points at the registration site', () => {
    expect(() =>
      validateAdapterModule(
        'nope' as unknown as AdapterModuleLike,
        'TemplateModule.forRoot',
      ),
    ).toThrow(/Invalid adapter provided to TemplateModule\.forRoot/);
  });

  it('names a class adapter by its class name', () => {
    expect(() =>
      validateAdapterModule({ nope: true } as unknown as AdapterModuleLike),
    ).toThrow(/UnknownAdapter/);
  });

  it('says what it expected instead', () => {
    expect(() =>
      validateAdapterModule('nope' as unknown as AdapterModuleLike),
    ).toThrow(
      /Expected a Nest module class, DynamicModule, forwardRef wrapper/,
    );
  });
});
