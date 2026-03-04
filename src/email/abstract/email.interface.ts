/**
 * Represents the base parameters required for sending an email.
 * Includes common fields such as recipient, sender, and subject.
 */
export interface BaseEmailParams {
  /** Email address of the recipient */
  to: string;
  /** Email address of the sender */
  from?: string;
  /** Optional subject line of the email */
  subject?: string;
}

/**
 * Represents the base parameters required for sending multiple emails.
 * Includes common fields such as recipients, sender, and subject.
 */
export interface BaseEmailMultipleParams {
  /** Array of recipient email addresses */
  to: string[];
  /** Email address of the sender */
  from: string;
  /** Optional subject line of the email */
  subject?: string;
}

/**
 * Represents a rendered email content with its metadata
 */
export interface RenderedEmailContent {
  /** The rendered HTML content of the email */
  html: string;
  /** The template ID to use for the email */
  templateId?: string;
  /** The parameters to be used in the template */
  params?: Record<string, any>;
}

type TemplateNameToParams<
  Templates extends Record<string, string>,
  Params extends Record<Templates[keyof Templates], any>,
> = {
  [K in Templates[keyof Templates]]: {
    name: K;
    templateId?: string;
    params: Params[K];
  };
}[Templates[keyof Templates]];

export type RenderEmailTemplateParams<
  Templates extends Record<string, string>,
  Params extends Record<Templates[keyof Templates], any>,
> = TemplateNameToParams<Templates, Params>;

// /**
//  * Parameters for rendering an email template
//  */
// export interface RenderEmailTemplateParams<
//   Templates extends Record<string, string>,
//   Params extends Record<Templates[keyof Templates], any>,
//   /** Name of the email template to use */
//   name: Templates[keyof Templates];
//   /** ID of the email template to use */
//   templateId?: string;
//   /** Parameters to be used in the template */
//   params: Params[Templates[keyof Templates]];
// }

/**
 * Parameters for sending an email with pre-rendered content
 */
export interface SendRenderedEmailParams extends BaseEmailParams {
  /** The rendered email content */
  content: RenderedEmailContent;
}

/**
 * Parameters for sending multiple emails with pre-rendered content
 */
export interface SendRenderedEmailMultipleParams
  extends BaseEmailMultipleParams {
  /** The rendered email content */
  content: RenderedEmailContent;
}

/**
 * Represents the response returned after sending an email.
 * @typeParam TPayload - The type of the response body (default: object)
 */
export interface MailingResponse<TPayload = object> {
  /** HTTP status code of the response */
  statusCode: number;
  /** Response body containing the result of the email operation */
  body: TPayload;
  /** Response headers */
  headers: Record<string, string>;
}
