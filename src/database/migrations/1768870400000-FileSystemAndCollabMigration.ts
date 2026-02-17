import { MigrationInterface, QueryRunner } from 'typeorm';

export class FileSystemAndCollabMigration1768870400000
  implements MigrationInterface
{
  name = 'FileSystemAndCollabMigration1768870400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Agregar columnas a Users
    await queryRunner.query(
      `ALTER TABLE "users" ADD "avatarUrl" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "avatarColor" character varying(7)`,
    );

    // 2. Crear nueva entidad Teams
    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "description" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_f220c8b3fd0a7b4169d9440c901" PRIMARY KEY ("id")
      )
    `);

    // 3. Tabla pivote Teams <-> Users
    await queryRunner.query(`
      CREATE TABLE "teams_members" (
        "team_id" uuid NOT NULL,
        "user_id" integer NOT NULL,
        CONSTRAINT "PK_teams_members_team_id_user_id" PRIMARY KEY ("team_id","user_id")
      )
    `);

    // 4. Tabla pivote Teams <-> Projects
    await queryRunner.query(`
      CREATE TABLE "teams_projects" (
        "team_id" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        CONSTRAINT "PK_teams_projects_team_id_project_id" PRIMARY KEY ("team_id","project_id")
      )
    `);

    // 5. Modificar Evidences para FileSystem
    await queryRunner.query(
      `ALTER TABLE "evidences" ADD "isFolder" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidences" ADD "mimeType" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "evidences" ADD "contentBlob" text`);
    await queryRunner.query(`ALTER TABLE "evidences" ADD "parentId" uuid`);
    await queryRunner.query(`ALTER TABLE "evidences" ADD "lockUserId" integer`);
    await queryRunner.query(
      `ALTER TABLE "evidences" ADD "lockExpiresAt" timestamp`,
    );

    // 6. FKs para Evidences
    await queryRunner.query(
      `ALTER TABLE "evidences" ADD CONSTRAINT "FK_evidence_parent" FOREIGN KEY ("parentId") REFERENCES "evidences"("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidences" ADD CONSTRAINT "FK_evidence_locker" FOREIGN KEY ("lockUserId") REFERENCES "users"("id")`,
    );

    // 7. FKs para tablas pivote
    await queryRunner.query(
      `ALTER TABLE "teams_members" ADD CONSTRAINT "FK_teams_members_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams_members" ADD CONSTRAINT "FK_teams_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "teams_projects" ADD CONSTRAINT "FK_teams_projects_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams_projects" ADD CONSTRAINT "FK_teams_projects_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teams_projects" DROP CONSTRAINT "FK_teams_projects_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams_projects" DROP CONSTRAINT "FK_teams_projects_team"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams_members" DROP CONSTRAINT "FK_teams_members_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams_members" DROP CONSTRAINT "FK_teams_members_team"`,
    );

    await queryRunner.query(
      `ALTER TABLE "evidences" DROP CONSTRAINT "FK_evidence_locker"`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidences" DROP CONSTRAINT "FK_evidence_parent"`,
    );

    await queryRunner.query(
      `ALTER TABLE "evidences" DROP COLUMN "lockExpiresAt"`,
    );
    await queryRunner.query(`ALTER TABLE "evidences" DROP COLUMN "lockUserId"`);
    await queryRunner.query(`ALTER TABLE "evidences" DROP COLUMN "parentId"`);
    await queryRunner.query(
      `ALTER TABLE "evidences" DROP COLUMN "contentBlob"`,
    );
    await queryRunner.query(`ALTER TABLE "evidences" DROP COLUMN "mimeType"`);
    await queryRunner.query(`ALTER TABLE "evidences" DROP COLUMN "isFolder"`);

    await queryRunner.query(`DROP TABLE "teams_projects"`);
    await queryRunner.query(`DROP TABLE "teams_members"`);
    await queryRunner.query(`DROP TABLE "teams"`);

    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarColor"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarUrl"`);
  }
}
