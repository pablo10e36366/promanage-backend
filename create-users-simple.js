const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function createUsersSimple() {
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

    // Verificar estructura de la tabla users
    const tableInfo = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('Estructura de la tabla users:');
    tableInfo.rows.forEach(col => {
      console.log(`- ${col.column_name} (${col.data_type})`);
    });

    // Obtener ID del rol admin
    const adminRoleResult = await client.query(`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`);
    if (adminRoleResult.rows.length === 0) {
      throw new Error('Rol admin no encontrado');
    }
    const adminRoleId = adminRoleResult.rows[0].id;

    // Obtener ID del rol usuario
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

    // Crear usuarios con consulta simple
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
        // Insertar sin columnas de fecha (usar defaults)
        await client.query(
          `INSERT INTO users (name, email, password, role_id)
           VALUES ($1, $2, $3, $4)`,
          [user.name, user.email, hashedPassword, user.roleId]
        );
        console.log(`✅ Usuario creado: ${user.email} (${user.name})`);
      } else {
        console.log(`⚠️ Usuario ya existe: ${user.email}`);
        
        // Actualizar contraseña
        await client.query(
          'UPDATE users SET password = $1 WHERE email = $2',
          [hashedPassword, user.email]
        );
        console.log(`   Contraseña actualizada para: ${user.email}`);
      }
    }

    // Mostrar todos los usuarios
    const allUsers = await client.query('SELECT email, name FROM users ORDER BY email');
    console.log('\n📋 Todos los usuarios en la base de datos:');
    allUsers.rows.forEach(row => {
      console.log(`- ${row.email} (${row.name})`);
    });

    console.log('\n🎉 Script completado!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Detalles:', error);
  } finally {
    await client.end();
  }
}

createUsersSimple();