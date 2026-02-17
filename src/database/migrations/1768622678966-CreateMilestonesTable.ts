import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMilestonesTable1768622678966 implements MigrationInterface {
  name = 'CreateMilestonesTable1768622678966';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."milestones_status_enum" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "milestones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(100) NOT NULL, "description" text, "order" integer NOT NULL, "dueDate" TIMESTAMP, "status" "public"."milestones_status_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "projectId" uuid, CONSTRAINT "PK_0bdbfe399c777a6a8520ff902d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ADD CONSTRAINT "FK_662a1f9d865fe49768fa369fd0f" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "milestones" DROP CONSTRAINT "FK_662a1f9d865fe49768fa369fd0f"`,
    );
    await queryRunner.query(`DROP TABLE "milestones"`);
    await queryRunner.query(`DROP TYPE "public"."milestones_status_enum"`);
  }
}
