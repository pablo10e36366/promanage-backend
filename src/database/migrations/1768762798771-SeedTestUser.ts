import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class SeedTestUser1768762798771 implements MigrationInterface {
  name = 'SeedTestUser1768762798771';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Obtener el ID del rol 'admin' para el segundo administrador
    const adminRoleResult = (await queryRunner.query(
      `SELECT id FROM roles WHERE name = 'admin' LIMIT 1`,
    )) as { id: number }[];
    
    if (adminRoleResult.length === 0) {
      throw new Error('Rol admin no encontrado');
    }
    const adminRoleId = adminRoleResult[0].id;

    // Obtener el ID del rol 'usuario' (o 'colaborador' si existe)
    const userRoleResult = (await queryRunner.query(
      `SELECT id FROM roles WHERE name IN ('usuario', 'colaborador', 'user') LIMIT 1`,
    )) as { id: number }[];
    
    let userRoleId: number;
    if (userRoleResult.length === 0) {
      // Si no hay rol 'usuario', usar el primer rol disponible
      const anyRole = (await queryRunner.query(
        `SELECT id FROM roles WHERE name != 'admin' LIMIT 1`,
      )) as { id: number }[];
      if (anyRole.length === 0) {
        throw new Error('No hay roles disponibles');
      }
      userRoleId = anyRole[0].id;
    } else {
      userRoleId = userRoleResult[0].id;
    }

    // 1. Crear segundo administrador
    const hashedAdminPassword = await bcrypt.hash('admin456', 10);
    await queryRunner.query(
      `
            INSERT INTO users (name, email, password, role_id)
            VALUES ('Administrador Secundario', 'admin2@example.com', $1, $2)
            ON CONFLICT (email) DO NOTHING;
        `,
      [hashedAdminPassword, adminRoleId],
    );

    // 2. Crear usuario Loop Tester
    const hashedTesterPassword = await bcrypt.hash('tester123', 10);
    await queryRunner.query(
      `
            INSERT INTO users (name, email, password, role_id)
            VALUES ('Loop Tester', 'tester@example.com', $1, $2)
            ON CONFLICT (email) DO NOTHING;
        `,
      [hashedTesterPassword, userRoleId],
    );

    // 3. Crear usuario de prueba adicional
    const hashedUserPassword = await bcrypt.hash('user123', 10);
    await queryRunner.query(
      `
            INSERT INTO users (name, email, password, role_id)
            VALUES ('Usuario Prueba', 'user@example.com', $1, $2)
            ON CONFLICT (email) DO NOTHING;
        `,
      [hashedUserPassword, userRoleId],
    );

    // 4. Crear otro usuario para completar los 4 integrantes del chat
    const hashedUser2Password = await bcrypt.hash('colab123', 10);
    await queryRunner.query(
      `
            INSERT INTO users (name, email, password, role_id)
            VALUES ('Colaborador Demo', 'colab@example.com', $1, $2)
            ON CONFLICT (email) DO NOTHING;
        `,
      [hashedUser2Password, userRoleId],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar los usuarios creados
    await queryRunner.query(`
            DELETE FROM users WHERE email IN (
              'admin2@example.com',
              'tester@example.com',
              'user@example.com',
              'colab@example.com'
            );
        `);
  }
}