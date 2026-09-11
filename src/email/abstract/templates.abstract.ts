export abstract class EmailTemplateService {
  abstract compile(
    templatePath: string,
    context: Record<string, unknown>,
  ): Promise<string>;
}
