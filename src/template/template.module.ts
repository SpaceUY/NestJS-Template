import { Module } from '@nestjs/common';
import { TemplateCoreModule } from './core/template-core.module';
import testTemplate from './templates/test/test.template';

@Module({
  imports: [TemplateCoreModule.forRoot([testTemplate])],
  exports: [TemplateCoreModule],
})
export class TemplateModule {}
