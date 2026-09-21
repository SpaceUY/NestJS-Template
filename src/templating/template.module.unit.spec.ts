import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TemplateModule } from './template.module';
import { TemplateService } from './abstract/template.service';
import { TEMPLATE_PROVIDER } from './abstract/template-provider.const';

class MockTemplateService extends TemplateService {
  compile = jest.fn().mockResolvedValue('<p>rendered</p>');
}

@Module({
  providers: [{ provide: TEMPLATE_PROVIDER, useClass: MockTemplateService }],
  exports: [TEMPLATE_PROVIDER],
})
class MockAdapterModule {}

type ProviderShape = {
  provide: unknown;
  inject: unknown[];
  useFactory: (...args: unknown[]) => unknown;
};

const serviceProvider = (moduleRef: {
  providers?: unknown[];
}): ProviderShape | undefined =>
  (moduleRef.providers as ProviderShape[]).find(
    (p) => p.provide === TemplateService,
  );

describe('TemplateModule', () => {
  describe('forRoot', () => {
    it('imports the adapter module and re-exposes its provider under the service token', () => {
      const moduleRef = TemplateModule.forRoot({
        adapter: MockAdapterModule,
        isGlobal: true,
      });

      expect(moduleRef.module).toBe(TemplateModule);
      expect(moduleRef.global).toBe(true);
      expect(moduleRef.imports).toEqual([MockAdapterModule]);
      expect(moduleRef.exports).toContain(TemplateService);
      expect(serviceProvider(moduleRef)?.inject).toEqual([TEMPLATE_PROVIDER]);
    });

    it('rejects an adapter that is not a module', () => {
      expect(() =>
        TemplateModule.forRoot({
          adapter: 'not-a-module' as unknown as typeof MockAdapterModule,
        }),
      ).toThrow('Invalid adapter provided to TemplateModule.forRoot');
    });
  });

  describe('forRootAsync', () => {
    it('provides the service from the caller factory and its injected tokens', async () => {
      const seen: unknown[] = [];

      const moduleRef = TemplateModule.forRootAsync({
        inject: ['TOKEN_A'],
        useFactory: (a: unknown) => {
          seen.push(a);
          return new MockTemplateService();
        },
      });

      const provider = serviceProvider(moduleRef);

      expect(provider?.inject).toEqual(['TOKEN_A']);
      expect(await provider?.useFactory('value-a')).toBeInstanceOf(
        MockTemplateService,
      );
      expect(seen).toEqual(['value-a']);
    });

    it('carries the caller imports through untouched and defaults global to false', () => {
      const moduleRef = TemplateModule.forRootAsync({
        imports: [MockAdapterModule],
        useFactory: () => new MockTemplateService(),
      });

      expect(moduleRef.imports).toEqual([MockAdapterModule]);
      expect(moduleRef.global).toBe(false);
      expect(moduleRef.exports).toContain(TemplateService);
    });

    it('awaits an async factory', async () => {
      const moduleRef = TemplateModule.forRootAsync({
        useFactory: async () => {
          await Promise.resolve();
          return new MockTemplateService();
        },
      });

      expect(await serviceProvider(moduleRef)?.useFactory()).toBeInstanceOf(
        MockTemplateService,
      );
    });
  });

  describe('resolved through a real Nest container', () => {
    it('forRoot resolves the adapter module provider under the service token', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [TemplateModule.forRoot({ adapter: MockAdapterModule })],
      }).compile();

      expect(moduleRef.get(TemplateService)).toBeInstanceOf(
        MockTemplateService,
      );

      await moduleRef.close();
    });

    it('forRootAsync composes with the adapter module through its provider token', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          TemplateModule.forRootAsync({
            imports: [MockAdapterModule],
            inject: [TEMPLATE_PROVIDER],
            useFactory: (adapter: TemplateService) => adapter,
          }),
        ],
      }).compile();

      expect(moduleRef.get(TemplateService)).toBeInstanceOf(
        MockTemplateService,
      );

      await moduleRef.close();
    });
  });
});
