export interface TemplateRenderer {
  compile(nameOrPath: string, params: Record<string, unknown>): Promise<string>;
}

export const TEMPLATE_RENDERER = Symbol('TEMPLATE_RENDERER');
