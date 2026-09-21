import { existsSync } from 'node:fs';
import { TEMPLATES, TEMPLATE_PATHS, TEMPLATE_SUBJECTS } from './template.const';

// The registry is three maps that must be edited together (rule 2 of
// src/templates/CLAUDE.md). Nothing but a test notices when one drifts.
describe('template registry', () => {
  const names = Object.values(TEMPLATES);

  it('has a path for every template', () => {
    expect(Object.keys(TEMPLATE_PATHS).sort()).toEqual([...names].sort());
  });

  it('has a subject for every template', () => {
    expect(Object.keys(TEMPLATE_SUBJECTS).sort()).toEqual([...names].sort());
  });

  it('keys every map by its own value', () => {
    for (const [key, value] of Object.entries(TEMPLATES)) {
      expect(value).toBe(key);
    }
  });

  it.each(Object.entries(TEMPLATE_PATHS))(
    'resolves %s to a file that exists',
    (_, path) => {
      expect(existsSync(path)).toBe(true);
    },
  );

  it.each(Object.entries(TEMPLATE_PATHS))(
    'addresses %s with a repo-relative path',
    (_, path) => {
      // PugAdapterService joins these onto a baseDir that defaults to the
      // process working directory, so an absolute path would escape it.
      expect(path.startsWith('src/templates/')).toBe(true);
    },
  );

  it.each(Object.entries(TEMPLATE_SUBJECTS))(
    'gives %s a non-empty subject',
    (_, subject) => {
      expect(subject.trim().length).toBeGreaterThan(0);
    },
  );
});
