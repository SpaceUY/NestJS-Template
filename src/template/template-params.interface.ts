import { VerificationParams } from "./auth/verification.interface";
import { WelcomeParams } from "./onboarding/welcome.interface";
import { TEMPLATES } from "./template.const";

export type Template = (typeof TEMPLATES)[keyof typeof TEMPLATES];

export interface TemplateParamsMap {
  [TEMPLATES.WELCOME]: WelcomeParams;
  [TEMPLATES.VERIFICATION]: VerificationParams;
}
