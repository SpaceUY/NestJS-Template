import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import baseConfig from '../config/base.config';
import databaseConfig from '../config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY, baseConfig.KEY],
      useFactory: (
        db: ConfigType<typeof databaseConfig>,
        base: ConfigType<typeof baseConfig>,
      ) => {
        const isProd = base.nodeEnv === 'PROD';
        const baseOptions = {
          type: 'postgres' as const,
          autoLoadEntities: true,
          synchronize: !isProd,
          logging: !isProd,
        };

        if (db.url) {
          return { ...baseOptions, url: db.url };
        }

        if (db.host && db.username && db.password && db.database) {
          return {
            ...baseOptions,
            host: db.host,
            port: db.port ?? 5432,
            username: db.username,
            password: db.password,
            database: db.database,
          };
        }

        throw new Error(
          'Database config incomplete. Provide DATABASE_URL or all of DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME.',
        );
      },
    }),
  ],
})

export class DatabaseModule {}
