# Templates (Assets)

Static, type-safe template assets (e.g., `.pug` files) and their registries/interfaces. This folder intentionally contains no Nest modules or providers.

---

## Overview

- Adapter-based: plug any engine (pug/handlebars/react-email/etc.)
- No coupling to mailing or other domains
- Simple API: `TemplateService.compile(nameOrPath, params)`
- Validated dynamic module wiring (reuses common utils)

---

## Directory Structure

```
src/templates/
├── auth/
│   ├── verification.interface.ts
│   └── verification.pug
├── onboarding/
│   ├── welcome.interface.ts
│   └── welcome.pug
├── template.const.ts            # central registry for names/paths/subjects
├── template-params.interface.ts # type map for template params
├── index.ts                     # asset exports (no modules here)
└── README.md
```

---

## Central Registry (recommended)

Use `template.const.ts` to keep a single source of truth.

```ts
export const TEMPLATES = {
  WELCOME: 'WELCOME',
  VERIFICATION: 'VERIFICATION',
} as const;

export const TEMPLATE_PATHS = {
  [TEMPLATES.WELCOME]: 'src/templates/onboarding/welcome.pug',
  [TEMPLATES.VERIFICATION]: 'src/templates/auth/verification.pug',
} as const;

export const TEMPLATE_SUBJECTS = {
  [TEMPLATES.WELCOME]: 'Welcome aboard',
  [TEMPLATES.VERIFICATION]: 'Verify your email',
} as const;
```

## Notes

- This folder should remain static (no Nest modules/providers).
- The service layer that renders these templates lives under `src/templating`.

## Reuse

**Two supported workflows.** Clone the template whole, or lift only the modules
you need — this one is written for both. What follows is the second case: what
`src/templates/` needs in order to compile in another project.

**What travels with it.** Nothing. `src/templates/` imports from no other
module and has no runtime dependency — not even `@nestjs/common`. It is a
typed registry (`template.const.ts`), a params interface and two `.pug` files.

Copy the directory whole, or take `template.const.ts` and
`template-params.interface.ts` as the pattern and supply your own templates.
Copy the `nest-cli.json` asset entry with it, or the `.pug` files will not
reach `dist/`.

**Peer dependencies.** None. Rendering them is `src/templating/`'s job, and
that module is optional here — the registry is just paths and parameter types.

**Removing it from the template instead.** Nothing imports this directory any
more. `src/app.controller.ts` used to, for `TEMPLATE_PATHS` in the `GET /email`
demo route, and that route was deleted — unguarded, it sent a real message to a
hardcoded address. Deleting `src/templates/` today costs one thing only: the
two starting-point templates and the typed registry pattern go with it, and
whoever adds email later writes both from scratch. See
`src/email/README.md`'s render-then-send recipe for how the pieces fit.
