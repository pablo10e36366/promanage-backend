import { MigrationInterface, QueryRunner } from 'typeorm';

export class RoleUpgradeRequests1771700000000 implements MigrationInterface {
  name = 'RoleUpgradeRequests1771700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS role_upgrade_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL,
        requested_role TEXT NOT NULL DEFAULT 'docente',
        message TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        admin_note TEXT,
        reviewed_by_user_id INTEGER,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_role_upgrade_requests_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_role_upgrade_requests_reviewer
          FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_role_upgrade_requests_user
      ON role_upgrade_requests(user_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_role_upgrade_requests_status
      ON role_upgrade_requests(status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_role_upgrade_requests_created_at
      ON role_upgrade_requests(created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS role_upgrade_requests`);
  }
}
