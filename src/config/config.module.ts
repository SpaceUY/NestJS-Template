import { Module } from '@nestjs/common';
import baseConfig from './base.config';
import { ConfigCoreModule } from './core/config-core.module';
import databaseConfig from './database.config';
import emailConfig from './email.config';
import googleConfig from './google.config';
import jwtConfig from './jwt.config';
import awsConfig from './aws.config';
import expoConfig from './expo.config';

@Module({
  imports: [
    ConfigCoreModule.forRoot([
      baseConfig,
      jwtConfig,
      databaseConfig,
      googleConfig,
      emailConfig,
      awsConfig,
      expoConfig,
    ]),
  ],
  exports: [ConfigCoreModule],
})
export class ConfigModule {}
