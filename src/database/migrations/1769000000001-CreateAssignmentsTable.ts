import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssignmentsTable1769000000001 implements MigrationInterface {
    name = 'CreateAssignmentsTable1769000000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "assignments" (
                "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                "projectId" UUID NOT NULL,
                "milestoneId" UUID,
                "studentId" INTEGER,
                "evidenceId" UUID,
                "status" VARCHAR(50) NOT NULL,
                "submittedAt" TIMESTAMP,
                "deadline" TIMESTAMP,
                "isLate" BOOLEAN DEFAULT false,
                "feedback" TEXT,
                "createdAt" TIMESTAMP DEFAULT NOW(),
                "updatedAt" TIMESTAMP DEFAULT NOW(),
                FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE,
                FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE SET NULL,
                FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE,
                FOREIGN KEY ("evidenceId") REFERENCES "evidences"("id") ON DELETE SET NULL
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "assignments"`);
    }
}