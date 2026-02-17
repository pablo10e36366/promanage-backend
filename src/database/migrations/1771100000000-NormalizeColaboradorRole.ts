import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Normaliza roles legacy a la convención actual:
 * - Rol "colaborador" es el equivalente a Estudiante.
 * - Evita que existan roles legacy como 'student', 'estudiante' o 'collaborator'.
 *
 * Esta migración es idempotente y segura para entornos de desarrollo.
 */
export class NormalizeColaboradorRole1771100000000 implements MigrationInterface {
  name = 'NormalizeColaboradorRole1771100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Asegurar roles mínimos
    await queryRunner.query(`
      INSERT INTO roles (name)
      VALUES ('admin'), ('docente'), ('colaborador')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Migrar usuarios desde roles legacy hacia 'colaborador' y eliminar legacy.
    await queryRunner.query(`
      DO $$
      DECLARE
        colaborador_id integer;
        old_id integer;
        old_name text;
      BEGIN
        SELECT id INTO colaborador_id FROM roles WHERE name = 'colaborador' LIMIT 1;
        IF colaborador_id IS NULL THEN
          INSERT INTO roles (name) VALUES ('colaborador') RETURNING id INTO colaborador_id;
        END IF;

        FOREACH old_name IN ARRAY ARRAY['student', 'estudiante', 'collaborator']
        LOOP
          SELECT id INTO old_id FROM roles WHERE name = old_name LIMIT 1;
          IF old_id IS NOT NULL THEN
            UPDATE users SET role_id = colaborador_id WHERE role_id = old_id;
            DELETE FROM roles WHERE id = old_id;
          END IF;
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No se revierte la normalización por seguridad (mantener 'colaborador').
  }
}

