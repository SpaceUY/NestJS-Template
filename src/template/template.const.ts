export const TEMPLATES = {
  WELCOME: "WELCOME",
  VERIFICATION: "VERIFICATION",
} as const;

export const TEMPLATE_PATHS = {
  [TEMPLATES.WELCOME]: "src/templates/onboarding/welcome.pug",
  [TEMPLATES.VERIFICATION]: "src/templates/auth/verification.pug",
} as const;

export const TEMPLATE_SUBJECTS = {
  [TEMPLATES.WELCOME]: "Welcome aboard",
  [TEMPLATES.VERIFICATION]: "Verify your email",
} as const;
