export abstract class EmailTemplateService {
  abstract compile(
    templatePath: string,
    // Caller-supplied template data of arbitrary shape. `unknown` is wrong here:
    // it rejects interface-typed objects, which have no implicit index signature.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: Record<string, any>,
  ): Promise<string>;
}
