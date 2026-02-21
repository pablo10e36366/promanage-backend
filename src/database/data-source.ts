import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

// Load environment variables for CLI migration commands.
config({ path: '.env' });

const configService = new ConfigService();
const dbSslRaw = (process.env.DB_SSL ?? '').toLowerCase();
const dbSslEnabled = ['true', '1', 'yes'].includes(dbSslRaw);
const dbPort = Number(process.env.DB_PORT ?? 5432);

export default new DataSource({
  type: 'postgres',
  host: configService.get<string>('DB_HOST'),
  port: Number.isNaN(dbPort) ? 5432 : dbPort,
  username: configService.get<string>('DB_USERNAME'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_NAME'),
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
  ssl: dbSslEnabled ? { rejectUnauthorized: false } : false,
});
