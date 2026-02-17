import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeacherTaskNavigation1771000000000 implements MigrationInterface {
  name = 'TeacherTaskNavigation1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Needed for gen_random_uuid()
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    // =============================================
    // 1) Projects: course code (unique per teacher)
    // =============================================
    await queryRunner.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS code VARCHAR(10)
    `);

    // Unique by owner (teacher) when code is present
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_owner_code
      ON projects(owner_id, code)
      WHERE code IS NOT NULL
    `);

    // =============================================
    // 2) Assignments: review outcome + reviewer
    // =============================================
    await queryRunner.query(`
      ALTER TABLE assignments
      ADD COLUMN IF NOT EXISTS "reviewOutcome" VARCHAR(50)
    `);

    await queryRunner.query(`
      ALTER TABLE assignments
      ADD COLUMN IF NOT EXISTS "reviewedById" INTEGER
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_assignments_reviewed_by'
            AND table_name = 'assignments'
        ) THEN
          ALTER TABLE assignments
          ADD CONSTRAINT fk_assignments_reviewed_by
          FOREIGN KEY ("reviewedById") REFERENCES users(id)
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_assignments_project_status_submitted
      ON assignments("projectId", status, "submittedAt" DESC)
    `);

    // =============================================
    // 3) Submission reviews (audit + rubric)
    // =============================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS submission_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "submissionId" UUID NOT NULL,
        "teacherId" INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL,
        feedback TEXT,
        "rubricScores" JSONB,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_submission_reviews_submission
          FOREIGN KEY ("submissionId") REFERENCES assignments(id) ON DELETE CASCADE,
        CONSTRAINT fk_submission_reviews_teacher
          FOREIGN KEY ("teacherId") REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_submission_reviews_submission
      ON submission_reviews("submissionId")
    `);

    // =============================================
    // 4) Threads (Q&A) + replies
    // =============================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "courseId" UUID NOT NULL,
        "teacherId" INTEGER NOT NULL,
        "authorId" INTEGER NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'UNANSWERED',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_threads_course
          FOREIGN KEY ("courseId") REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_threads_teacher
          FOREIGN KEY ("teacherId") REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_threads_author
          FOREIGN KEY ("authorId") REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_threads_teacher_status_created
      ON threads("teacherId", status, "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_threads_course_status_created
      ON threads("courseId", status, "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS thread_replies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "threadId" UUID NOT NULL,
        "authorId" INTEGER NOT NULL,
        message TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_thread_replies_thread
          FOREIGN KEY ("threadId") REFERENCES threads(id) ON DELETE CASCADE,
        CONSTRAINT fk_thread_replies_author
          FOREIGN KEY ("authorId") REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_thread_replies_thread_created
      ON thread_replies("threadId", "createdAt" DESC)
    `);

    // =============================================
    // 5) Activity feed events (normalized)
    // =============================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS activity_feed_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "teacherId" INTEGER NOT NULL,
        "courseId" UUID NOT NULL,
        type VARCHAR(50) NOT NULL,
        "actorType" VARCHAR(20) NOT NULL,
        "actorId" INTEGER,
        "actorName" VARCHAR(120),
        "entityId" UUID,
        title VARCHAR(255),
        metadata JSONB,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_activity_feed_events_teacher
          FOREIGN KEY ("teacherId") REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_activity_feed_events_course
          FOREIGN KEY ("courseId") REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_feed_events_course_created
      ON activity_feed_events("courseId", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_feed_events_teacher_created
      ON activity_feed_events("teacherId", "createdAt" DESC)
    `);

    // =============================================
    // 6) Stats tables (materialized counters)
    // =============================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS course_stats (
        "courseId" UUID PRIMARY KEY,
        "teacherId" INTEGER NOT NULL,
        "studentsCount" INTEGER NOT NULL DEFAULT 0,
        "pendingSubmissionsCount" INTEGER NOT NULL DEFAULT 0,
        "unansweredThreadsCount" INTEGER NOT NULL DEFAULT 0,
        "overdueSubmissionsCount" INTEGER NOT NULL DEFAULT 0,
        "lastActivityAt" TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_course_stats_course
          FOREIGN KEY ("courseId") REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_course_stats_teacher
          FOREIGN KEY ("teacherId") REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_course_stats_teacher
      ON course_stats("teacherId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS teacher_stats (
        "teacherId" INTEGER PRIMARY KEY,
        "pendingSubmissionsCount" INTEGER NOT NULL DEFAULT 0,
        "unansweredThreadsCount" INTEGER NOT NULL DEFAULT 0,
        "overdueCount" INTEGER NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_teacher_stats_teacher
          FOREIGN KEY ("teacherId") REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // =============================================
    // 7) Refresh tokens (sessions)
    // =============================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" INTEGER NOT NULL,
        "tokenHash" TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP NOT NULL,
        "revokedAt" TIMESTAMP,
        "userAgent" TEXT,
        "ipAddress" TEXT,
        CONSTRAINT fk_refresh_tokens_user
          FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_expires
      ON refresh_tokens("userId", "expiresAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order to satisfy FKs
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS teacher_stats`);
    await queryRunner.query(`DROP TABLE IF EXISTS course_stats`);
    await queryRunner.query(`DROP TABLE IF EXISTS activity_feed_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS thread_replies`);
    await queryRunner.query(`DROP TABLE IF EXISTS threads`);
    await queryRunner.query(`DROP TABLE IF EXISTS submission_reviews`);

    await queryRunner.query(`
      ALTER TABLE assignments
      DROP COLUMN IF EXISTS "reviewedById"
    `);
    await queryRunner.query(`
      ALTER TABLE assignments
      DROP COLUMN IF EXISTS "reviewOutcome"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_projects_owner_code
    `);
    await queryRunner.query(`
      ALTER TABLE projects
      DROP COLUMN IF EXISTS code
    `);
  }
}
