#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);

const REQUIRED_SECTIONS = [
  '## Scope',
  '## Public surface',
  '## Rules',
  '## Tests',
  '## Reuse',
  '## Known gaps',
];

// A backticked string is checked only when it names a file (known extension) or
// a directory (trailing slash) — so extensionless module specifiers like
// `src/cache/abstract/cache.service` and prose like `src/...` are ignored.
// A leading `!` inverts the assertion: the path is documented as NOT existing,
// which is how a doc records drift in a neighbouring file without the validator
// treating that citation as its own error.
const PATH_LIKE =
  /^!?(src|docs|scripts|test|@types)\/[\w./-]+(\.(ts|mjs|js|json|md|pug|yml)|\/)$/;

/**
 * Recursively collects every CLAUDE.md and README.md path under `dir`,
 * repo-relative.
 * @param {string} dir Absolute directory to walk.
 * @returns {Promise<string[]>} Repo-relative CLAUDE.md/README.md paths.
 */
async function collectDocs(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await collectDocs(full)));
    else if (entry.name === 'CLAUDE.md' || entry.name === 'README.md') {
      found.push(relative(ROOT, full));
    }
  }
  return found;
}

/**
 * Extracts repo-path-looking strings from backtick spans, dropping any
 * trailing `:12` or `:12-34` line reference.
 * @param {string} text Markdown source.
 * @returns {string[]} Candidate repo paths.
 */
function referencedPaths(text) {
  return [...text.matchAll(/`([^`\n]+)`/g)]
    .map((m) => m[1].replace(/:\d+(-\d+)?$/, ''))
    .filter((candidate) => PATH_LIKE.test(candidate));
}

/**
 * Runs every rule over every CLAUDE.md and README.md and reports violations.
 * The six required sections and the module-map rule are CLAUDE.md-only. A
 * README's only required section is `## Reuse`: the template is meant to be
 * taken whole *or* module by module, so every module states what it needs in
 * order to compile elsewhere — in its README for the human and in its
 * CLAUDE.md for the agent. Everything else in a README is free-form, and the
 * path-existence rule below applies to both files.
 * @returns {Promise<string[]>} Human-readable violation lines.
 */
async function check() {
  const violations = [];
  const docs = await collectDocs(ROOT);

  for (const doc of docs) {
    const text = await readFile(join(ROOT, doc), 'utf8');
    const isModuleClaudeDoc = doc !== 'CLAUDE.md' && doc.endsWith('CLAUDE.md');

    if (isModuleClaudeDoc) {
      for (const section of REQUIRED_SECTIONS) {
        if (!text.includes(`\n${section}\n`)) {
          violations.push(`${doc}: missing required section "${section}"`);
        }
      }

      const readme = doc.replace(/CLAUDE\.md$/, 'README.md');
      if (!existsSync(join(ROOT, readme))) {
        violations.push(`${doc}: no sibling "${readme}"`);
      } else if (
        !(await readFile(join(ROOT, readme), 'utf8')).includes('\n## Reuse\n')
      ) {
        violations.push(`${readme}: missing required section "## Reuse"`);
      }
    }

    for (const reference of referencedPaths(text)) {
      const mustBeAbsent = reference.startsWith('!');
      const path = mustBeAbsent ? reference.slice(1) : reference;
      const present = existsSync(join(ROOT, path));

      if (!mustBeAbsent && !present) {
        violations.push(`${doc}: references missing path "${path}"`);
      }
      if (mustBeAbsent && present) {
        violations.push(
          `${doc}: "${path}" is documented as absent but now exists`,
        );
      }
    }
  }

  const rootText = await readFile(join(ROOT, 'CLAUDE.md'), 'utf8');
  for (const doc of docs.filter(
    (d) => d !== 'CLAUDE.md' && d.endsWith('CLAUDE.md'),
  )) {
    if (!rootText.includes(doc)) {
      violations.push(`CLAUDE.md: module map does not list "${doc}"`);
    }
  }

  return [...new Set(violations)];
}

const violations = await check();
if (violations.length > 0) {
  console.error(`docs:check failed with ${violations.length} violation(s):`);
  for (const line of violations) console.error(`  ${line}`);
  process.exit(1);
}
console.log('docs:check passed');
