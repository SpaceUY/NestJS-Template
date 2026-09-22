export const TEMPLATES = {
  WELCOME: 'WELCOME',
  VERIFICATION: 'VERIFICATION',
  SPACESHIP_CREATED: 'SPACESHIP_CREATED',
} as const;

export const TEMPLATE_PATHS = {
  [TEMPLATES.WELCOME]: 'src/templates/onboarding/welcome.pug',
  [TEMPLATES.VERIFICATION]: 'src/templates/auth/verification.pug',
  [TEMPLATES.SPACESHIP_CREATED]:
    'src/templates/spaceship/spaceship-created.pug',
} as const;

export const TEMPLATE_SUBJECTS = {
  [TEMPLATES.WELCOME]: 'Welcome aboard',
  [TEMPLATES.VERIFICATION]: 'Verify your email',
  [TEMPLATES.SPACESHIP_CREATED]: 'A new spaceship has been registered',
} as const;
