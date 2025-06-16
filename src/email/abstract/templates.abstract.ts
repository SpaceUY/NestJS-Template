export abstract class EmailTemplateService {
  abstract compile(templatePath: string, context: any): Promise<string>;
}
