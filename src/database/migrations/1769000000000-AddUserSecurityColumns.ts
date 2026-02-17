import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSecurityColumns1769587000000 implements MigrationInterface {
    name = 'AddUserSecurityColumns1769587000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add isActive column with default true
        await queryRunner.query(`
      DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='isActive') THEN
          ALTER TABLE "users" ADD COLUMN "isActive" boolean NOT NULL DEFAULT true;
      END IF;
      END $$;
    `);

        // Add blockedAt column (nullable)
        await queryRunner.query(`
      DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='blockedAt') THEN
          ALTER TABLE "users" ADD COLUMN "blockedAt" timestamp NULL;
      END IF;
      END $$;
    `);

        // Add blockedBy column (nullable, references admin user ID)
        await queryRunner.query(`
      DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='blockedBy') THEN
          ALTER TABLE "users" ADD COLUMN "blockedBy" integer NULL;
      END IF;
      END $$;
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert changes in reverse order
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "blockedBy"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "blockedAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isActive"`);
    }
}