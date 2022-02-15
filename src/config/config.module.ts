import { Module } from '@nestjs/common';
import baseConfig from './base.config';
import { ConfigCoreModule } from './core/config-core.module';
import databaseConfig from './database.config';
import googleConfig from './google.config';
import jwtConfig from './jwt.config';

@Module({
  imports: [
    ConfigCoreModule.forRoot([
      baseConfig,
      jwtConfig,
      databaseConfig,
      googleConfig,
    ]),
  ],
  exports: [ConfigCoreModule],
})
export class ConfigModule {}
