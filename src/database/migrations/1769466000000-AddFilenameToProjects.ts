import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFilenameToProjects1769466000000 implements MigrationInterface {
    name = 'AddFilenameToProjects1769466000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS filename VARCHAR(255)
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE projects 
      DROP COLUMN IF EXISTS filename
    `);
    }
}
