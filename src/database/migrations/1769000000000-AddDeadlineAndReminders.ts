import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeadlineAndReminders1769000000000
  implements MigrationInterface
{
  name = 'AddDeadlineAndReminders1769000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add deadline column to projects table
    await queryRunner.query(`
      ALTER TABLE "projects" 
      ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMP
    `);

    // Create reminders table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reminders" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "title" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "dueDate" TIMESTAMP,
        "isCompleted" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "user_id" INTEGER REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reminders_user" ON "reminders"("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reminders_due" ON "reminders"("dueDate")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_projects_deadline" ON "projects"("deadline")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_projects_deadline"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reminders_due"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reminders_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reminders"`);
    await queryRunner.query(
      `ALTER TABLE "projects" DROP COLUMN IF EXISTS "deadline"`,
    );
  }
}
