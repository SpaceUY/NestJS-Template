import { Global, Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Spaceship } from './entities/spaceship.entity';
import { databaseScope, DatabaseScopeConfig } from './config/database.scope';

/**
 * Turns the `database` config scope into TypeORM connection options.
 *
 * `DATABASE_URL` wins when present; otherwise every discrete field must be
 * there, because a half-filled config would otherwise reach the driver as a
 * connection to localhost with no credentials.
 *
 * @param {DatabaseScopeConfig} db - The resolved `database` scope.
 * @returns {TypeOrmModuleOptions} Options for `TypeOrmModule.forRootAsync`.
 * @throws {Error} When neither the URL nor the complete discrete set is given.
 */
export function buildTypeOrmOptions(
  db: DatabaseScopeConfig,
): TypeOrmModuleOptions {
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
}

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [databaseScope.KEY],
      useFactory: buildTypeOrmOptions,
    }),
    TypeOrmModule.forFeature([User, Spaceship]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
