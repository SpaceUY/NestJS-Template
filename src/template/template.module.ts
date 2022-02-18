import { Module } from '@nestjs/common';
import { TemplateCoreModule } from './core/template-core.module';
import testTemplate from './templates/test/test.template';
import test2Template from './templates/test2/test2.template';

@Module({
  imports: [TemplateCoreModule.forRoot([testTemplate, test2Template])],
  exports: [TemplateCoreModule],
})
export class TemplateModule {}
