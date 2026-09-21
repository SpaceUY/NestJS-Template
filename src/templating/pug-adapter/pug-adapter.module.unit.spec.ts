import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DynamicModule, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PugAdapterConfig, PugAdapterModule } from './pug-adapter.module';
import { PugAdapterService } from './pug-adapter.service';
import { TEMPLATE_PROVIDER } from '../abstract/template-provider.const';
import { TemplateService } from '../abstract/template.service';

type ProviderShape = {
  provide: unknown;
  useExisting?: unknown;
  inject?: unknown[];
  useFactory?: (...args: unknown[]) => unknown;
};

const shapes = (moduleRef: DynamicModule): ProviderShape[] =>
  (moduleRef.providers ?? []) as ProviderShape[];

const providerFor = (
  moduleRef: DynamicModule,
  token: unknown,
): ProviderShape | undefined =>
  shapes(moduleRef).find((p) => p.provide === token);

const build = async (moduleRef: DynamicModule): Promise<TemplateService> =>
  (await providerFor(
    moduleRef,
    TEMPLATE_PROVIDER,
  )?.useFactory?.()) as TemplateService;

@Module({
  providers: [{ provide: 'PUG_BASE_DIR', useValue: { baseDir: '/tmp' } }],
  exports: ['PUG_BASE_DIR'],
})
class ConfigStubModule {}

describe('PugAdapterModule', () => {
  let baseDir: string;

  beforeAll(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'pug-adapter-module-'));
    await writeFile(join(baseDir, 'greeting.pug'), 'p Hello #{name}\n');
  });

  afterAll(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  describe('register', () => {
    it('builds a Pug adapter and aliases the abstract service to it', () => {
      const moduleRef = PugAdapterModule.register();

      expect(moduleRef.module).toBe(PugAdapterModule);
      expect(providerFor(moduleRef, TemplateService)?.useExisting).toBe(
        TEMPLATE_PROVIDER,
      );
      expect(moduleRef.exports).toEqual([TEMPLATE_PROVIDER, TemplateService]);
    });

    it('registers without a config at all', async () => {
      expect(await build(PugAdapterModule.register())).toBeInstanceOf(
        PugAdapterService,
      );
    });

    // The only observable effect of the config is where templates are read
    // from, so that is what proves it reached the service rather than being
    // dropped on the way.
    it('hands the configured baseDir to the adapter it builds', async () => {
      const service = await build(PugAdapterModule.register({ baseDir }));

      await expect(
        service.compile('greeting.pug', { name: 'Astro' }),
      ).resolves.toBe('<p>Hello Astro</p>');
    });
  });

  describe('registerAsync', () => {
    it('builds the adapter from the caller factory and its injected tokens', async () => {
      const seen: PugAdapterConfig[] = [];

      // The parameter is typed, not `unknown`. That is the point: until
      // `registerAsync` took `<TArgs extends unknown[]>`, this call site did
      // not compile (`TS2322` — function parameters are contravariant, so a
      // typed factory is not assignable to `(...args: unknown[]) => …`). Every
      // other async factory in the template already threaded the tuple
      // through; this one did not, and nothing caught it because
      // `src/app.module.ts` uses the synchronous `register({})`. If someone
      // reverts the generic, this file stops type-checking.
      const moduleRef = PugAdapterModule.registerAsync({
        inject: ['PUG_BASE_DIR'],
        useFactory: (config: PugAdapterConfig) => {
          seen.push(config);
          return config;
        },
      });

      const provider = providerFor(moduleRef, TEMPLATE_PROVIDER);

      expect(provider?.inject).toEqual(['PUG_BASE_DIR']);
      expect(await provider?.useFactory?.({ baseDir })).toBeInstanceOf(
        PugAdapterService,
      );
      expect(seen).toEqual([{ baseDir }]);
    });

    it('hands the resolved baseDir to the adapter it builds', async () => {
      const moduleRef = PugAdapterModule.registerAsync({
        useFactory: () => ({ baseDir }),
      });

      const service = (await providerFor(
        moduleRef,
        TEMPLATE_PROVIDER,
      )?.useFactory?.()) as TemplateService;

      await expect(
        service.compile('greeting.pug', { name: 'Astro' }),
      ).resolves.toBe('<p>Hello Astro</p>');
    });

    it('awaits an async factory', async () => {
      const moduleRef = PugAdapterModule.registerAsync({
        useFactory: async () => {
          await Promise.resolve();
          return { baseDir };
        },
      });

      expect(
        await providerFor(moduleRef, TEMPLATE_PROVIDER)?.useFactory?.(),
      ).toBeInstanceOf(PugAdapterService);
    });

    it('defaults imports and inject to empty arrays when omitted', () => {
      const moduleRef = PugAdapterModule.registerAsync({
        useFactory: () => ({}),
      });

      expect(moduleRef.imports).toEqual([]);
      expect(providerFor(moduleRef, TEMPLATE_PROVIDER)?.inject).toEqual([]);
    });

    it('carries the caller imports through untouched and keeps the alias', () => {
      const moduleRef = PugAdapterModule.registerAsync({
        imports: [ConfigStubModule],
        useFactory: () => ({}),
      });

      expect(moduleRef.imports).toEqual([ConfigStubModule]);
      expect(providerFor(moduleRef, TemplateService)?.useExisting).toBe(
        TEMPLATE_PROVIDER,
      );
      expect(moduleRef.exports).toEqual([TEMPLATE_PROVIDER, TemplateService]);
    });
  });

  // `useExisting` is an alias, not a second provider. A consumer injecting
  // `TemplateService` (`T1`) has to land on the very instance the adapter
  // token holds, not on a second Pug adapter with its own baseDir.
  describe('resolved through a real Nest container', () => {
    it('register resolves both tokens to one instance', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [PugAdapterModule.register({ baseDir })],
      }).compile();

      const service = moduleRef.get(TemplateService);

      expect(service).toBeInstanceOf(PugAdapterService);
      expect(service).toBe(moduleRef.get(TEMPLATE_PROVIDER));

      await moduleRef.close();
    });

    it('registerAsync resolves both tokens to one instance', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          PugAdapterModule.registerAsync({
            imports: [ConfigStubModule],
            inject: ['PUG_BASE_DIR'],
            useFactory: () => ({ baseDir }),
          }),
        ],
      }).compile();

      const service = moduleRef.get(TemplateService);

      expect(service).toBeInstanceOf(PugAdapterService);
      expect(service).toBe(moduleRef.get(TEMPLATE_PROVIDER));

      await moduleRef.close();
    });
  });
});
