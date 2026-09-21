import { DatabaseScopeConfig } from './config/database.scope';
import { buildTypeOrmOptions } from './database.module';

describe('buildTypeOrmOptions', () => {
  const base: DatabaseScopeConfig = { synchronize: false, logging: true };

  const discrete: DatabaseScopeConfig = {
    ...base,
    host: 'localhost',
    port: 6432,
    username: 'app',
    password: 'a-password',
    database: 'app_db',
  };

  const url = 'postgres://app:a-password@localhost:5432/app_db';

  it('prefers the connection URL when one is configured', () => {
    const options = buildTypeOrmOptions({ ...discrete, url });

    expect(options).toEqual({
      type: 'postgres',
      autoLoadEntities: true,
      synchronize: false,
      logging: true,
      url,
    });
    expect(options).not.toHaveProperty('host');
  });

  it('builds discrete options when no URL is configured', () => {
    expect(buildTypeOrmOptions(discrete)).toEqual({
      type: 'postgres',
      autoLoadEntities: true,
      synchronize: false,
      logging: true,
      host: 'localhost',
      port: 6432,
      username: 'app',
      password: 'a-password',
      database: 'app_db',
    });
  });

  it('defaults the port to 5432', () => {
    const { port, ...withoutPort } = discrete;
    void port;

    expect(buildTypeOrmOptions(withoutPort)).toMatchObject({ port: 5432 });
  });

  it('carries synchronize and logging through untouched', () => {
    expect(
      buildTypeOrmOptions({ ...discrete, synchronize: true, logging: false }),
    ).toMatchObject({ synchronize: true, logging: false });
  });

  // A half-filled config would otherwise reach the driver as a connection to
  // localhost with no credentials, which fails far from its cause.
  it.each(['host', 'username', 'password', 'database'] as const)(
    'refuses a config missing %s',
    (field) => {
      const incomplete = { ...discrete };
      delete incomplete[field];

      expect(() => buildTypeOrmOptions(incomplete)).toThrow(
        /Database config incomplete/,
      );
    },
  );

  it('names both ways to configure it in the failure message', () => {
    expect(() => buildTypeOrmOptions(base)).toThrow(
      /Provide DATABASE_URL or all of DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME/,
    );
  });
});
