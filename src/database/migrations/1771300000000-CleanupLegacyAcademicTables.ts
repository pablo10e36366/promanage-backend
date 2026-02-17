import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupLegacyAcademicTables1771300000000 implements MigrationInterface {
  name = 'CleanupLegacyAcademicTables1771300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "course_members" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "student_works" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "classroom_enrollments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "virtual_classrooms" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "courses" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "description" character varying,
        "code" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_courses_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "virtual_classrooms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "code" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "startDate" TIMESTAMP,
        "endDate" TIMESTAMP,
        "isPublic" boolean NOT NULL DEFAULT false,
        "maxStudents" integer NOT NULL DEFAULT 50,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "professor_id" integer,
        CONSTRAINT "PK_virtual_classrooms_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "classroom_enrollments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "status" character varying NOT NULL DEFAULT 'PENDING',
        "enrolledAt" TIMESTAMP,
        "reviewedAt" TIMESTAMP,
        "reviewedBy" integer,
        "reviewNotes" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "student_id" integer,
        "classroom_id" uuid,
        CONSTRAINT "PK_classroom_enrollments_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "student_works" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "description" text,
        "fileUrl" character varying,
        "submittedAt" TIMESTAMP,
        "reviewedAt" TIMESTAMP,
        "reviewedBy" integer,
        "grade" numeric(5,2),
        "feedback" text,
        "status" character varying NOT NULL DEFAULT 'DRAFT',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "student_id" integer,
        "classroom_id" uuid,
        "project_id" uuid,
        "content" text,
        "fileType" character varying,
        CONSTRAINT "PK_student_works_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_members" (
        "course_id" uuid NOT NULL,
        "user_id" integer NOT NULL,
        CONSTRAINT "PK_course_members" PRIMARY KEY ("course_id", "user_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "virtual_classrooms"
      ADD CONSTRAINT "FK_virtual_classrooms_professor"
      FOREIGN KEY ("professor_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "classroom_enrollments"
      ADD CONSTRAINT "FK_classroom_enrollments_student"
      FOREIGN KEY ("student_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "classroom_enrollments"
      ADD CONSTRAINT "FK_classroom_enrollments_classroom"
      FOREIGN KEY ("classroom_id") REFERENCES "virtual_classrooms"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "student_works"
      ADD CONSTRAINT "FK_student_works_student"
      FOREIGN KEY ("student_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "student_works"
      ADD CONSTRAINT "FK_student_works_classroom"
      FOREIGN KEY ("classroom_id") REFERENCES "virtual_classrooms"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "student_works"
      ADD CONSTRAINT "FK_student_works_project"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "course_members"
      ADD CONSTRAINT "FK_course_members_course"
      FOREIGN KEY ("course_id") REFERENCES "courses"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "course_members"
      ADD CONSTRAINT "FK_course_members_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }
}
