export abstract class TemplateService {
  abstract compile(
    nameOrPath: string,
    params: Record<string, unknown>,
  ): Promise<string>;
}
