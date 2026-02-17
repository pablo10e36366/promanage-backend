import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupTeamsTables1771500000000 implements MigrationInterface {
  name = 'CleanupTeamsTables1771500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "teams_members" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teams" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teams" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teams_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teams_members" (
        "team_id" uuid NOT NULL,
        "user_id" integer NOT NULL,
        CONSTRAINT "PK_teams_members_team_id_user_id" PRIMARY KEY ("team_id","user_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "teams_members"
      ADD CONSTRAINT "FK_teams_members_team"
      FOREIGN KEY ("team_id") REFERENCES "teams"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "teams_members"
      ADD CONSTRAINT "FK_teams_members_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }
}
