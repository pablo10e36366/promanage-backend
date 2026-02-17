import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedRoles1768530424308 implements MigrationInterface {
  name = 'SeedRoles1768530424308';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insertar roles base si no existen
    await queryRunner.query(`
            INSERT INTO roles (name)
            VALUES ('admin'), ('profesor'), ('estudiante')
            ON CONFLICT (name) DO NOTHING;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar los roles insertados (opcional, solo para revertir)
    await queryRunner.query(`
            DELETE FROM roles WHERE name IN ('admin', 'profesor', 'estudiante');
        `);
  }
}
