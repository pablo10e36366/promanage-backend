import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupZombieTeamsProjects1771400000000
  implements MigrationInterface
{
  name = 'CleanupZombieTeamsProjects1771400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "teams_projects" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teams_projects" (
        "team_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        CONSTRAINT "PK_teams_projects_team_id_project_id" PRIMARY KEY ("team_id","project_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "teams_projects"
      ADD CONSTRAINT "FK_teams_projects_team"
      FOREIGN KEY ("team_id") REFERENCES "teams"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "teams_projects"
      ADD CONSTRAINT "FK_teams_projects_project"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }
}
