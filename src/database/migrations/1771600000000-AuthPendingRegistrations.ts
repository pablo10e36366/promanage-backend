import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthPendingRegistrations1771600000000 implements MigrationInterface {
  name = 'AuthPendingRegistrations1771600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth_pending_registrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "codeHash" TEXT NOT NULL,
        "tokenHash" TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP NOT NULL,
        "consumedAt" TIMESTAMP,
        attempts INTEGER NOT NULL DEFAULT 0,
        "lastSentAt" TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_pending_registrations_email
      ON auth_pending_registrations(email)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_pending_registrations_token
      ON auth_pending_registrations("tokenHash")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_pending_registrations_expires
      ON auth_pending_registrations("expiresAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS auth_pending_registrations`);
  }
}
