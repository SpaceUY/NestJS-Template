import { VerificationParams } from './auth/verification.interface';
import { WelcomeParams } from './onboarding/welcome.interface';
import { SpaceshipCreatedParams } from './spaceship/spaceship-created.interface';
import { TEMPLATES } from './template.const';

export type Template = (typeof TEMPLATES)[keyof typeof TEMPLATES];

export interface TemplateParamsMap {
  [TEMPLATES.WELCOME]: WelcomeParams;
  [TEMPLATES.VERIFICATION]: VerificationParams;
  [TEMPLATES.SPACESHIP_CREATED]: SpaceshipCreatedParams;
}
