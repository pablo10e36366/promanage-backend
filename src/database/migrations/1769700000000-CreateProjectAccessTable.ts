import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateProjectAccessTable1769700000000 implements MigrationInterface {
    name = 'CreateProjectAccessTable1769700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'project_access',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'project_id',
                        type: 'uuid',
                        isNullable: false,
                    },
                    {
                        name: 'user_id',
                        type: 'integer',
                        isNullable: false,
                    },
                    {
                        name: 'permission',
                        type: 'varchar',
                        length: '10',
                        isNullable: false,
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '20',
                        isNullable: false,
                        default: "'PENDING'",
                    },
                    {
                        name: 'granted_by',
                        type: 'integer',
                        isNullable: true,
                    },
                    {
                        name: 'requested_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'resolved_at',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'notes',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );

        // Create unique constraint on (project_id, user_id)
        await queryRunner.query(`
      ALTER TABLE "project_access" 
      ADD CONSTRAINT "UQ_project_access_project_user" 
      UNIQUE ("project_id", "user_id")
    `);

        // Create indexes
        await queryRunner.createIndex(
            'project_access',
            new TableIndex({
                name: 'IDX_project_access_project',
                columnNames: ['project_id'],
            }),
        );

        await queryRunner.createIndex(
            'project_access',
            new TableIndex({
                name: 'IDX_project_access_user',
                columnNames: ['user_id'],
            }),
        );

        await queryRunner.createIndex(
            'project_access',
            new TableIndex({
                name: 'IDX_project_access_status',
                columnNames: ['status'],
            }),
        );

        // Create foreign keys
        await queryRunner.createForeignKey(
            'project_access',
            new TableForeignKey({
                columnNames: ['project_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'projects',
                onDelete: 'CASCADE',
            }),
        );

        await queryRunner.createForeignKey(
            'project_access',
            new TableForeignKey({
                columnNames: ['user_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'users',
                onDelete: 'CASCADE',
            }),
        );

        await queryRunner.createForeignKey(
            'project_access',
            new TableForeignKey({
                columnNames: ['granted_by'],
                referencedColumnNames: ['id'],
                referencedTableName: 'users',
                onDelete: 'SET NULL',
            }),
        );

        // Add CHECK constraints
        await queryRunner.query(`
      ALTER TABLE "project_access" 
      ADD CONSTRAINT "CHK_project_access_permission" 
      CHECK (permission IN ('VIEW', 'EDIT'))
    `);

        await queryRunner.query(`
      ALTER TABLE "project_access" 
      ADD CONSTRAINT "CHK_project_access_status" 
      CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED'))
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop CHECK constraints
        await queryRunner.query(`ALTER TABLE "project_access" DROP CONSTRAINT "CHK_project_access_status"`);
        await queryRunner.query(`ALTER TABLE "project_access" DROP CONSTRAINT "CHK_project_access_permission"`);

        // Drop foreign keys
        const table = await queryRunner.getTable('project_access');
        if (table) {
            const foreignKeys = table.foreignKeys;
            for (const fk of foreignKeys) {
                await queryRunner.dropForeignKey('project_access', fk);
            }
        }

        // Drop indexes
        await queryRunner.dropIndex('project_access', 'IDX_project_access_status');
        await queryRunner.dropIndex('project_access', 'IDX_project_access_user');
        await queryRunner.dropIndex('project_access', 'IDX_project_access_project');

        // Drop unique constraint
        await queryRunner.query(`ALTER TABLE "project_access" DROP CONSTRAINT "UQ_project_access_project_user"`);

        // Drop table
        await queryRunner.dropTable('project_access');
    }
}
