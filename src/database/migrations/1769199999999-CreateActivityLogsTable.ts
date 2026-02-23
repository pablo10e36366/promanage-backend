import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateActivityLogsTable1769199999999 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Para gen_random_uuid()
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // 1) Crear el enum SI NO existe (para que luego pueda hacer ALTER TYPE sin fallar)
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "activity_logs_action_enum" AS ENUM ('GENERIC');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // 2) Crear la tabla usando ese enum
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "activity_logs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "action" "activity_logs_action_enum" NOT NULL DEFAULT 'GENERIC',
        "description" TEXT,
        "metadata" JSONB DEFAULT '{}'::jsonb,
        "reactions" JSONB DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "userId" INTEGER,
        "projectId" UUID
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_logs"`);
    await queryRunner.query(`
      DO $$
      BEGIN
        DROP TYPE "activity_logs_action_enum";
      EXCEPTION
        WHEN undefined_object THEN NULL;
      END $$;
    `);
  }
}