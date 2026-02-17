const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function createTestUsers() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'promanage_db',
    user: 'postgres',
    password: 'Andres123'
  });

  try {
    await client.connect();
    console.log('Conectado a la base de datos');

    // Obtener ID del rol admin
    const adminRoleResult = await client.query(`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`);
    if (adminRoleResult.rows.length === 0) {
      throw new Error('Rol admin no encontrado');
    }
    const adminRoleId = adminRoleResult.rows[0].id;

    // Obtener ID del rol usuario/colaborador
    const userRoleResult = await client.query(`SELECT id FROM roles WHERE name IN ('usuario', 'colaborador', 'user') LIMIT 1`);
    let userRoleId;
    if (userRoleResult.rows.length === 0) {
      // Usar cualquier rol que no sea admin
      const anyRole = await client.query(`SELECT id FROM roles WHERE name != 'admin' LIMIT 1`);
      if (anyRole.rows.length === 0) {
        throw new Error('No hay roles disponibles');
      }
      userRoleId = anyRole.rows[0].id;
    } else {
      userRoleId = userRoleResult.rows[0].id;
    }

    // Crear usuarios
    const users = [
      {
        name: 'Administrador Secundario',
        email: 'admin2@example.com',
        password: 'admin456',
        roleId: adminRoleId
      },
      {
        name: 'Loop Tester',
        email: 'tester@example.com',
        password: 'tester123',
        roleId: userRoleId
      },
      {
        name: 'Usuario Prueba',
        email: 'user@example.com',
        password: 'user123',
        roleId: userRoleId
      },
      {
        name: 'Colaborador Demo',
        email: 'colab@example.com',
        password: 'colab123',
        roleId: userRoleId
      }
    ];

    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      // Verificar si el usuario ya existe
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [user.email]
      );

      if (existingUser.rows.length === 0) {
        await client.query(
          `INSERT INTO users (name, email, password, role_id, "isActive", "created_at", "updated_at")
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
          [user.name, user.email, hashedPassword, user.roleId]
        );
        console.log(`✅ Usuario creado: ${user.email} (${user.name})`);
      } else {
        console.log(`⚠️ Usuario ya existe: ${user.email}`);
        
        // Actualizar contraseña por si acaso
        await client.query(
          'UPDATE users SET password = $1, "updated_at" = NOW() WHERE email = $2',
          [hashedPassword, user.email]
        );
        console.log(`   Contraseña actualizada para: ${user.email}`);
      }
    }

    // Mostrar todos los usuarios
    const allUsers = await client.query('SELECT email, name, "isActive" FROM users ORDER BY email');
    console.log('\n📋 Todos los usuarios en la base de datos:');
    allUsers.rows.forEach(row => {
      console.log(`- ${row.email} (${row.name}) - Activo: ${row.isActive}`);
    });

    console.log('\n🎉 Usuarios de prueba creados/actualizados exitosamente!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

createTestUsers();