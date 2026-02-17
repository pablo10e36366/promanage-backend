import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEvidencesTable1768623944551 implements MigrationInterface {
  name = 'CreateEvidencesTable1768623944551';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."evidences_status_enum" AS ENUM('SUBMITTED', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."evidences_type_enum" AS ENUM('LINK', 'FILE', 'TEXT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "evidences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying, "url" character varying, "description" text, "feedback" text, "status" "public"."evidences_status_enum" NOT NULL DEFAULT 'SUBMITTED', "type" "public"."evidences_type_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "milestoneId" uuid, "authorId" integer, CONSTRAINT "PK_bffc6fa8c23f9fd2e2a6d165d45" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidences" ADD CONSTRAINT "FK_ca15c04eca1d5f55b8417d46bd9" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidences" ADD CONSTRAINT "FK_36faa67b72a523f5a3eefec6dfd" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evidences" DROP CONSTRAINT "FK_36faa67b72a523f5a3eefec6dfd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidences" DROP CONSTRAINT "FK_ca15c04eca1d5f55b8417d46bd9"`,
    );
    await queryRunner.query(`DROP TABLE "evidences"`);
    await queryRunner.query(`DROP TYPE "public"."evidences_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."evidences_status_enum"`);
  }
}
