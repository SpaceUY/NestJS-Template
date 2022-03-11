import * as path from 'path';
import * as pug from 'pug';

export type TemplateLocals = { [key: string]: any };
export interface TemplateRegistration<
  T extends TemplateLocals = TemplateLocals,
> {
  templateName: string;
  compileTemplate: pug.compileTemplate;
  compileHTML: (locals: T) => string;
}
export const TEMPLATE_PREFIX = 'TEMPLATE_';
export interface TemplateLocalsKeyHost {
  KEY: string;
}

export function registerTemplate<TLocals extends TemplateLocals>(
  templateName: string,
): TemplateRegistration<TLocals> & TemplateLocalsKeyHost {
  // I'm sorry if this drains your sanity
  const callerDir = path.dirname(
    (new Error().stack as string)
      .split('\n')[2]
      .split('(')[1]
      .split(':')
      .slice(0, -2)
      .join(':'),
  );

  const templateRegistration: TemplateRegistration<TLocals> = {
    templateName,
    compileTemplate: pug.compileFile(
      path.resolve(callerDir, `${templateName}.pug`),
    ),
    compileHTML: (locals: TLocals) =>
      templateRegistration.compileTemplate(locals),
  };

  Object.defineProperty(templateRegistration, 'KEY', {
    configurable: false,
    enumerable: false,
    value: `${TEMPLATE_PREFIX}${templateName}`,
    writable: false,
  });

  return templateRegistration as TemplateRegistration<TLocals> &
    TemplateLocalsKeyHost;
}
