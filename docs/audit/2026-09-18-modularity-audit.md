# NestJS Template — Modularity & Documentation Audit, 2026-09-18

Audited against commit `ea4d7e1` on `master`, with `pnpm install --frozen-lockfile`
completed.

| Gate | Result |
|---|---|
| `pnpm run build` | PASSES — exit 0 |
| `pnpm exec eslint` | 0 errors, 4 warnings |
| `pnpm test` | 36 suites, 295 tests, all passed |
| `pnpm run docs:check` | passed |

## What this audit asks

The template's stated purpose (`CLAUDE.md`, opening paragraph) is that every
top-level directory under `src/` can be lifted into another repository on its
own, and that a clone can be stripped down to the modules a project needs.
This audit tests that claim three ways: statically (the import graph), by
experiment (compiling an extracted module in isolation), and by reading every
guide the template ships to see whether it still describes the code.

Finding IDs are stable. `M` = modularity, `EXT` = extraction, `DOC` =
documentation. Findings from `docs/audit/2026-09-11-template-audit.md` keep
their original IDs and are reconciled in the last section. When a finding is
fixed, strike it here rather than deleting it, so citations stay resolvable.

### Module independence

### Extraction

### Contract conformance

### Agent guides (CLAUDE.md)

### Human guides (README.md)

### Prior-audit reconciliation
