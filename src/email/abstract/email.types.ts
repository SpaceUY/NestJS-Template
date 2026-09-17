import {
  SendRenderedEmailParams,
  RenderedEmailContent,
} from '../abstract/email.interface';

/**
 * Type helper to create a type-safe email configuration.
 * @typeParam TEMPLATES - The template object type (e.g., typeof TEMPLATES)
 * @typeParam PARAMS - The mapping of template names to their parameter types
 */
export type EmailConfig<
  TEMPLATES extends Record<string, string>,
  // Caller-supplied template data of arbitrary shape. `unknown` is wrong here:
  // it rejects interface-typed objects, which have no implicit index signature.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PARAMS extends Record<TEMPLATES[keyof TEMPLATES], Record<string, any>>,
> = {
  templates: TEMPLATES;
  params: PARAMS;
};

/**
 * Type helper to create a type-safe email sending params with rendered content.
 * @typeParam C - The email configuration type
 */
export type TemplateSendParams = Omit<SendRenderedEmailParams, 'content'> & {
  content: RenderedEmailContent;
};

/**
 * Type helper to create a type-safe email sending params for any template in the configuration.
 * @typeParam C - The email configuration type
 */
export type ConfiguredSendParams = TemplateSendParams;
