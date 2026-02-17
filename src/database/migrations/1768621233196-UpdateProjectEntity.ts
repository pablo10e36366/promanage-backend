import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateProjectEntity1768621233196 implements MigrationInterface {
  name = 'UpdateProjectEntity1768621233196';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_bd55b203eb9f92b0c8390380010"`,
    );
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "created_at"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "user_id"`);
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "repositoryUrl" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "isPublic" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "projects" ADD "owner_id" integer`);
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50"`,
    );
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id")`,
    );
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "status"`);
    await queryRunner.query(
      `CREATE TYPE "public"."projects_status_enum" AS ENUM('DRAFT', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'PUBLISHED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "status" "public"."projects_status_enum" NOT NULL DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_b1bd2fbf5d0ef67319c91acb5cf" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_b1bd2fbf5d0ef67319c91acb5cf"`,
    );
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."projects_status_enum"`);
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "status" character varying NOT NULL DEFAULT 'activo'`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50"`,
    );
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "id"`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "id" SERIAL NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id")`,
    );
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "owner_id"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "createdAt"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "isPublic"`);
    await queryRunner.query(
      `ALTER TABLE "projects" DROP COLUMN "repositoryUrl"`,
    );
    await queryRunner.query(`ALTER TABLE "projects" ADD "user_id" integer`);
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_bd55b203eb9f92b0c8390380010" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
