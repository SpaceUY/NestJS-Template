import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from 'src/config/database.config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (dbConf: ConfigType<typeof databaseConfig>) =>
        ({
          type: dbConf.type as any, // TypeOrmModule's useFactory doesn't like `type` being a variable, so using `any` overrides any type issues
          host: dbConf.host,
          port: dbConf.port,
          username: dbConf.username,
          password: dbConf.password,
          database: dbConf.database,
          entities: ['dist/**/*.{model,entity}{.ts,.js}'],
          synchronize: false,
        } as PostgresConnectionOptions),
      inject: [databaseConfig.KEY],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
