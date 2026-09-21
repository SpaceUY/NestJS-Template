import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PugAdapterService } from './pug-adapter.service';

describe('PugAdapterService', () => {
  let baseDir: string;

  beforeAll(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'pug-adapter-'));
    await mkdir(join(baseDir, 'templates'), { recursive: true });
    await writeFile(
      join(baseDir, 'templates', 'greeting.pug'),
      'p Hello #{name}\n',
    );
    await writeFile(join(baseDir, 'templates', 'escaping.pug'), 'p #{name}\n');
  });

  afterAll(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('compiles a template relative to the configured baseDir', async () => {
    const service = new PugAdapterService({ baseDir });

    await expect(
      service.compile('templates/greeting.pug', { name: 'Astro' }),
    ).resolves.toBe('<p>Hello Astro</p>');
  });

  // Rule 5 of src/templates/CLAUDE.md: a raw interpolation of user-supplied
  // content is an XSS bug in an email client. `#{}` must escape.
  it('escapes interpolated parameters', async () => {
    const service = new PugAdapterService({ baseDir });

    const html = await service.compile('templates/escaping.pug', {
      name: '<script>alert(1)</script>',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('defaults baseDir to the working directory', async () => {
    const service = new PugAdapterService();

    // The repo-relative paths in TEMPLATE_PATHS only resolve because of this.
    await expect(
      service.compile('src/templates/onboarding/welcome.pug', {
        name: 'Astro',
      }),
    ).resolves.toContain('Hello Astro,');
  });

  it('fails loudly for a template that is not on disk', async () => {
    const service = new PugAdapterService({ baseDir });

    await expect(
      service.compile('templates/missing.pug', {}),
    ).rejects.toThrow();
  });
});
