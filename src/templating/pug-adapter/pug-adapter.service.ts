import * as pug from 'pug';
import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { TemplateService } from '../abstract/template.service';

@Injectable()
export class PugAdapterService implements TemplateService {
  private readonly baseDir: string;

  constructor(config: { baseDir?: string } = {}) {
    this.baseDir = config.baseDir || process.cwd();
  }

  async compile(
    nameOrPath: string,
    params: Record<string, unknown>,
  ): Promise<string> {
    const fullPath = join(this.baseDir, nameOrPath);
    const compiled = pug.compileFile(fullPath);
    return compiled(params);
  }
}
