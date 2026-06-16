import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const synchronize = process.env.DB_SYNCHRONIZE === 'true';
const logging = process.env.DB_LOGGING !== 'false';

const shared = {
  type: 'postgres' as const,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/**/*.{ts,js}'],
  synchronize,
  logging,
};

export const AppDataSource = new DataSource(
  process.env.DATABASE_URL
    ? { ...shared, url: process.env.DATABASE_URL }
    : {
        ...shared,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT
          ? Number.parseInt(process.env.DB_PORT, 10)
          : 5432,
        username: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
      },
);
