import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class SeedAdminUser1768762798770 implements MigrationInterface {
  name = 'SeedAdminUser1768762798770';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Obtener el ID del rol 'admin'
    const roleResult = (await queryRunner.query(
      `SELECT id FROM roles WHERE name = 'admin' LIMIT 1`,
    )) as { id: number }[];
    if (roleResult.length === 0) {
      throw new Error('Rol admin no encontrado');
    }
    const roleId = roleResult[0].id;

    // Hash de la contraseña (admin123)
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Insertar usuario admin si no existe
    await queryRunner.query(
      `
            INSERT INTO users (name, email, password, role_id)
            VALUES ('Administrador', 'admin@example.com', $1, $2)
            ON CONFLICT (email) DO NOTHING;
        `,
      [hashedPassword, roleId],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar el usuario admin
    await queryRunner.query(`
            DELETE FROM users WHERE email = 'admin@example.com';
        `);
  }
}
