import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigFactory } from '@nestjs/config';
import Joi = require('joi');

@Module({})
export class ConfigCoreModule {
  static forRoot(configs: Array<ConfigFactory>): DynamicModule {
    return {
      module: ConfigCoreModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: configs,
          validationSchema: Joi.object(
            configs.reduce(
              (acc, cur) => ({ ...acc, ...cur['VALIDATION'] }),
              {},
            ),
          ),
        }),
      ],
      exports: [ConfigModule],
    };
  }
}
