#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, dirname, normalize } from 'node:path';

const ARGV = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = ARGV.indexOf(name);
  return i === -1 || i + 1 >= ARGV.length ? fallback : ARGV[i + 1];
};

const ROOT = flag('--root', process.cwd());
const BASELINE = flag('--baseline', 'docs/audit/module-independence-baseline.json');
const UPDATE = ARGV.includes('--update-baseline');
const REPORT = ARGV.includes('--report');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);
const APP_ROOT = '(app)';

// Tier order: a module may import its own tier or a LOWER-indexed one, never a
// higher one. Platform code must not know about features; infrastructure must
// not know about the demo domain. Derived from docs/architecture/module-contract.md.
const TIER_ORDER = ['platform', 'infrastructure', 'feature', 'app'];
const TIERS = {
  common: 'platform',
  'config-provider': 'platform',
  cache: 'infrastructure',
  'cloud-storage': 'infrastructure',
  database: 'infrastructure',
  email: 'infrastructure',
  'push-notification': 'infrastructure',
  queues: 'infrastructure',
  templating: 'infrastructure',
  auth: 'feature',
  spaceship: 'feature',
  templates: 'feature',
  user: 'feature',
  [APP_ROOT]: 'app',
};

/**
 * Collects every .ts file under `dir`, repo-relative, skipping build output.
 * @param {string} dir Absolute directory to walk.
 * @returns {Promise<string[]>} Relative .ts paths.
 */
async function collectSources(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await collectSources(full)));
    else if (entry.name.endsWith('.ts')) found.push(relative(ROOT, full));
  }
  return found;
}

/**
 * Maps a repo-relative path to the module that owns it.
 * `src/cache/abstract/x.ts` -> `cache`; `src/main.ts` -> `(app)`.
 * @param {string} file Repo-relative path.
 * @returns {string} Module name.
 */
function moduleOf(file) {
  const parts = file.split('/');
  return parts.length > 2 ? parts[1] : APP_ROOT;
}

/**
 * Extracts every import/export specifier from TypeScript source text.
 * @param {string} text Source text.
 * @returns {string[]} Raw module specifiers.
 */
function specifiersOf(text) {
  return [...text.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

/**
 * Applies the four independence rules to the whole tree.
 * @returns {Promise<{violations: string[], edges: Map<string, string[]>}>}
 */
async function analyse() {
  const violations = [];
  const edges = new Map();
  const files = await collectSources(join(ROOT, 'src'));

  for (const file of files) {
    const text = await readFile(join(ROOT, file), 'utf8');
    const from = moduleOf(file);

    for (const spec of specifiersOf(text)) {
      if (spec.startsWith('src/')) {
        violations.push(`abs-import|${file}|${spec}`);
        continue;
      }
      if (!spec.startsWith('.')) continue; // package import, not our concern

      const target = normalize(join(dirname(file), spec));
      if (!target.startsWith('src')) continue;
      const to = moduleOf(target);
      if (to === from) continue;

      const key = `${from} -> ${to}`;
      edges.set(key, [...(edges.get(key) ?? []), `${file}|${spec}`]);

      if (to === APP_ROOT) {
        violations.push(`app-root|${file}|${spec}`);
        continue;
      }
      const fromTier = TIER_ORDER.indexOf(TIERS[from] ?? 'feature');
      const toTier = TIER_ORDER.indexOf(TIERS[to] ?? 'feature');
      if (toTier > fromTier) {
        violations.push(`tier|${file}|${from}(${TIERS[from]}) -> ${to}(${TIERS[to]})`);
      }
    }
  }

  for (const key of edges.keys()) {
    const [a, b] = key.split(' -> ');
    if (a < b && edges.has(`${b} -> ${a}`)) violations.push(`cycle|${a}|${b}`);
  }

  return { violations: [...new Set(violations)].sort(), edges };
}

const { violations, edges } = await analyse();

if (REPORT) {
  console.log('# module edges');
  for (const key of [...edges.keys()].sort()) {
    console.log(`${key}  (${edges.get(key).length})`);
    for (const site of edges.get(key)) console.log(`    ${site}`);
  }
  console.log('\n# violations');
  for (const v of violations) console.log(v);
}

if (UPDATE) {
  await writeFile(
    join(ROOT, BASELINE),
    `${JSON.stringify({ generated: new Date().toISOString().slice(0, 10), violations }, null, 2)}\n`,
  );
  console.log(`baseline written: ${violations.length} known violation(s)`);
  process.exit(0);
}

const baselinePath = join(ROOT, BASELINE);
const known = existsSync(baselinePath)
  ? new Set(JSON.parse(await readFile(baselinePath, 'utf8')).violations)
  : new Set();

const added = violations.filter((v) => !known.has(v));
const removed = [...known].filter((v) => !violations.includes(v));

for (const v of removed) console.log(`fixed (drop from baseline): ${v}`);

if (added.length > 0) {
  console.error(`module independence: ${added.length} NEW violation(s):`);
  for (const v of added) console.error(`  ${v}`);
  console.error('\nFix it, or run with --update-baseline and justify it in review.');
  process.exit(1);
}
console.log(
  `module independence: no new violations (${known.size} known, ${removed.length} now fixed)`,
);
