import { DynamicModule, Module } from '@nestjs/common';
import { TemplateRegistration } from './template-base';

export interface TemplateType<TReg extends TemplateRegistration> {
  compileHTML: TReg['compileHTML'];
}

@Module({})
export class TemplateCoreModule {
  static forRoot(templates: Array<TemplateRegistration>): DynamicModule {
    return {
      module: TemplateCoreModule,
      providers: templates.map((template) => ({
        provide: template['KEY'],
        useValue: template,
      })),
      exports: templates.map((template) => template['KEY']),
    };
  }
}
