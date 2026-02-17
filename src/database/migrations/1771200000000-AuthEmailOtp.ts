import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthEmailOtp1771200000000 implements MigrationInterface {
  name = 'AuthEmailOtp1771200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Needed for gen_random_uuid() defaults
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth_email_otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        purpose TEXT NOT NULL,
        "codeHash" TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP NOT NULL,
        "consumedAt" TIMESTAMP,
        attempts INTEGER NOT NULL DEFAULT 0,
        "lastSentAt" TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_email_otps_email_purpose
      ON auth_email_otps(email, purpose)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_email_otps_expires
      ON auth_email_otps("expiresAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS auth_email_otps`);
  }
}
