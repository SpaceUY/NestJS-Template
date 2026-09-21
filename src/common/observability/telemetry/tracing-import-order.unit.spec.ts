import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MAIN = join(__dirname, '..', '..', '..', 'main.ts');
const BOOTSTRAP = './common/observability/telemetry/tracing.bootstrap';

/**
 * Rule 1 of this module's guide, as a test rather than a sentence.
 *
 * The OpenTelemetry instrumentations patch `http`, `pg` and `ioredis` when
 * those modules are first `require()`d. If anything imports them before
 * `tracing.bootstrap` has started the SDK, the patching silently misses and
 * the app runs untraced — no error, no warning, just empty waterfalls. A
 * reordering during an unrelated edit is exactly how that happens, so the
 * order is asserted here instead of only being asked for in prose.
 */
describe('src/main.ts import order', () => {
  const firstImport = (): string => {
    const line = readFileSync(MAIN, 'utf8')
      .split('\n')
      .find((candidate) => candidate.trimStart().startsWith('import'));

    if (!line) throw new Error('src/main.ts has no import statement');
    return line;
  };

  it('starts with the tracing bootstrap, before every other import', () => {
    expect(firstImport()).toBe(`import '${BOOTSTRAP}';`);
  });

  it('imports the bootstrap for its side effect only', () => {
    // `import { x } from './tracing.bootstrap'` would still run first, but it
    // would also suggest the module exports something callers should use. It
    // does not: starting the SDK is the whole point.
    expect(firstImport()).not.toMatch(/\bfrom\b/);
  });
});
