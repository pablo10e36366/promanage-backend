import { MigrationInterface, QueryRunner } from "typeorm";

export class AuditSyncSchema1769466500000 implements MigrationInterface {
    name = 'AuditSyncSchema1769466500000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // --- 0. SAFETY CLEANUP (In case of partial previous runs) ---
        // Commmented out Enum cleanup to avoid accidental drops if we are not recreating
        // await queryRunner.query(`DROP TYPE IF EXISTS "public"."activity_logs_action_enum_old" CASCADE`);
        // await queryRunner.query(`DROP TYPE IF EXISTS "public"."projects_status_enum_old" CASCADE`);

        // --- 1. CLEANUP ORPHANED CONSTRAINTS & INDEXES ---
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "FK_f09680dd23a6d5a242a458c56f6"`); // course_id
        await queryRunner.query(`ALTER TABLE "versions" DROP CONSTRAINT IF EXISTS "fk_versions_evidence"`);
        await queryRunner.query(`ALTER TABLE "versions" DROP CONSTRAINT IF EXISTS "fk_versions_author"`);
        await queryRunner.query(`ALTER TABLE "reminders" DROP CONSTRAINT IF EXISTS "reminders_user_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "fk_messages_project"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "fk_messages_author"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "fk_messages_thread"`);

        // Drop manual indexes that presumably mismatch Entity definitions
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_projects_deadline"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_versions_evidence"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_versions_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_reminders_user"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_reminders_due"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_messages_project"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_messages_thread"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_messages_created"`);

        // --- 2. CREATE MISSING TABLES ---
        // Reviews
        // Check if type exists to avoid error? CREATE TYPE IF NOT EXISTS is not standard PG < 9.x but ok in modern.
        // Postgres has issues with CREATE TYPE IF NOT EXISTS. Using DO block is safest.
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."reviews_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."reviews_status_enum" NOT NULL DEFAULT 'PENDING', "score" integer, "feedback" text, "details" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "authorId" integer NOT NULL, "projectId" uuid NOT NULL, CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`);

        // --- 3. DROP REMOVED COLUMNS (EVA / LEGACY) ---
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "course_id"`);

        // --- 4. FIX ROLES DESCRIPTION ---
        await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN IF EXISTS "description"`);
        await queryRunner.query(`ALTER TABLE "roles" ADD "description" character varying`);

        // --- 5. SYNC ENUMS (SAFE - SKIPPED FOR NOW DUE TO ERROR) ---
        /*
        // Activity Logs
        await queryRunner.query(`ALTER TYPE "public"."activity_logs_action_enum" RENAME TO "activity_logs_action_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."activity_logs_action_enum" AS ENUM('SUBMIT_EVIDENCE', 'REVIEW_EVIDENCE', 'PROJECT_CREATE', 'PROJECT_STATUS_CHANGE', 'PROJECT_UPDATE', 'PROJECT_DELETE', 'PROJECT_ARCHIVE', 'PROJECT_DEADLINE_CHANGE', 'FILE_UPLOAD', 'FILE_VERSION_NEW', 'FILE_RESTORE', 'FILE_DELETE', 'COMMENT_ADD', 'REVIEW_REQUEST', 'REVIEW_RESOLVE', 'USER_ASSIGN', 'USER_ROLE_CHANGE', 'MESSAGE_SENT')`);
        await queryRunner.query(`ALTER TABLE "activity_logs" ALTER COLUMN "action" TYPE "public"."activity_logs_action_enum" USING "action"::"text"::"public"."activity_logs_action_enum"`);
        await queryRunner.query(`DROP TYPE "public"."activity_logs_action_enum_old"`);

        // Projects Status (LOWERCASE MIGRATION)
        await queryRunner.query(`UPDATE "projects" SET "status" = lower("status")::"public"."projects_status_enum_old"`); 
        
        await queryRunner.query(`ALTER TYPE "public"."projects_status_enum" RENAME TO "projects_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."projects_status_enum" AS ENUM('draft', 'in_progress', 'in_review', 'completed')`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" TYPE "public"."projects_status_enum" USING lower("status"::"text")::"public"."projects_status_enum"`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'draft'`);
        await queryRunner.query(`DROP TYPE "public"."projects_status_enum_old"`);
        */

        // --- 6. FIX COLUMN TYPES ---

        // Fix Versions Title
        await queryRunner.query(`ALTER TABLE "versions" ALTER COLUMN "title" TYPE character varying`);

        // Fix Versions ChangeDescription
        await queryRunner.query(`ALTER TABLE "versions" ALTER COLUMN "changeDescription" TYPE character varying`);

        // Fix Versions CreatedAt
        await queryRunner.query(`ALTER TABLE "versions" ALTER COLUMN "createdAt" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "versions" ALTER COLUMN "createdAt" SET DEFAULT now()`);

        // Fix Reminders
        await queryRunner.query(`ALTER TABLE "reminders" DROP COLUMN IF EXISTS "title"`);
        await queryRunner.query(`ALTER TABLE "reminders" ADD IF NOT EXISTS "title" character varying NOT NULL DEFAULT 'Reminder'`);
        await queryRunner.query(`ALTER TABLE "reminders" ALTER COLUMN "isCompleted" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reminders" ALTER COLUMN "createdAt" SET NOT NULL`);

        // Fix Messages
        await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "createdAt" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "createdAt" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "updatedAt" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "updatedAt" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "isEdited" SET NOT NULL`);

        // --- 7. RESTORE/SYNC FOREIGN KEYS (IDEMPOTENT) ---
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_48770372f891b9998360e4434f3"`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_48770372f891b9998360e4434f3" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_ee90086bb783380da5453d240b9"`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_ee90086bb783380da5453d240b9" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "versions" DROP CONSTRAINT IF EXISTS "FK_15fc89df7b7ade9cf36d0fb31ef"`);
        await queryRunner.query(`ALTER TABLE "versions" ADD CONSTRAINT "FK_15fc89df7b7ade9cf36d0fb31ef" FOREIGN KEY ("evidenceId") REFERENCES "evidences"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "versions" DROP CONSTRAINT IF EXISTS "FK_98948bccb53c4082b318b91ea87"`);
        await queryRunner.query(`ALTER TABLE "versions" ADD CONSTRAINT "FK_98948bccb53c4082b318b91ea87" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "reminders" DROP CONSTRAINT IF EXISTS "FK_586e0b8e419125be507701cee2a"`);
        await queryRunner.query(`ALTER TABLE "reminders" ADD CONSTRAINT "FK_586e0b8e419125be507701cee2a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "FK_15f9bd2bf472ff12b6ee20012d0"`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_15f9bd2bf472ff12b6ee20012d0" FOREIGN KEY ("threadId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "FK_5954c28c2b781d390a9585297a4"`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_5954c28c2b781d390a9585297a4" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "FK_819e6bb0ee78baf73c398dc707f"`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_819e6bb0ee78baf73c398dc707f" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Skipped
    }
}
