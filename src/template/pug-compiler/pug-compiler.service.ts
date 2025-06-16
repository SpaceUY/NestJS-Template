import * as pug from "pug";
import { EmailTemplateService } from "../../email/abstract/templates.abstract";
import { TEMPLATE_PATHS } from "../index";
import { Injectable } from "@nestjs/common";
import { join } from "path";

@Injectable()
export class PugCompilerService implements EmailTemplateService {
  private currentPath: string;
  constructor() {
    this.currentPath = process.cwd();
  }

  async compile(
    templatePath: string,
    context: pug.LocalsObject,
  ): Promise<string> {
    const fullPath = join(
      this.currentPath,
      TEMPLATE_PATHS[templatePath as keyof typeof TEMPLATE_PATHS],
    );

    const compiledFunction = pug.compileFile(fullPath);
    return Promise.resolve(compiledFunction(context));
  }
}
