import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Spaceship } from './entities/spaceship.entity';
import { databaseScope, DatabaseScopeConfig } from './config/database.scope';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [databaseScope.KEY],
      useFactory: (db: DatabaseScopeConfig) => {
        const baseOptions = {
          type: 'postgres' as const,
          autoLoadEntities: true,
          synchronize: db.synchronize,
          logging: db.logging,
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
    TypeOrmModule.forFeature([User, Spaceship]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
