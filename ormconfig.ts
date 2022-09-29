import { InitialState1664467206702 } from 'migrations/1664467206702-InitialState';
import { Spaceship } from 'src/spaceship/spaceship.entity';
import { User } from 'src/user/user.model';
import { DataSource, DataSourceOptions } from 'typeorm';

const connectionSource = new DataSource({
  migrationsTableName: 'migrations',
  type: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  logging: true,
  synchronize: false,
  entities: [Spaceship, User],
  migrations: [InitialState1664467206702],
  migrationsRun: true,
} as DataSourceOptions);

export default connectionSource;
