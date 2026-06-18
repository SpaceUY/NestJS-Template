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

