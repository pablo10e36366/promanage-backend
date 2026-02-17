const { Client } = require('pg');
require('dotenv').config();

async function updateUserRole() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'Andres123',
    database: process.env.DB_NAME || 'promanage_db',
  });

  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos');

    // 1. Obtener ID del rol "professor" (correcto)
    const professorRoleResult = await client.query(
      'SELECT id FROM roles WHERE name = $1',
      ['professor']
    );
    
    if (professorRoleResult.rows.length === 0) {
      console.log('❌ No se encontró el rol "professor"');
      return;
    }
    
    const professorRoleId = professorRoleResult.rows[0].id;
    console.log(`✅ Rol "professor" encontrado con ID: ${professorRoleId}`);

    // 2. Obtener ID del rol "profesor" (incorrecto)
    const profesorRoleResult = await client.query(
      'SELECT id FROM roles WHERE name = $1',
      ['profesor']
    );
    
    let profesorRoleId = null;
    if (profesorRoleResult.rows.length > 0) {
      profesorRoleId = profesorRoleResult.rows[0].id;
      console.log(`⚠️  Rol "profesor" (incorrecto) encontrado con ID: ${profesorRoleId}`);
    }

    // 3. Actualizar usuario profesor@example.com para usar el rol correcto
    console.log('\n🔄 Actualizando usuario profesor@example.com...');
    const updateResult = await client.query(
      'UPDATE users SET role_id = $1 WHERE email = $2',
      [professorRoleId, 'profesor@example.com']
    );
    
    console.log(`✅ Usuario actualizado: ${updateResult.rowCount} fila(s) afectada(s)`);

    // 4. Verificar la actualización
    const userResult = await client.query(
      `SELECT u.id, u.name, u.email, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = $1`,
      ['profesor@example.com']
    );
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log('\n📋 Usuario actualizado:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Nombre: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Rol: ${user.role_name}`);
    }

    // 5. Opcional: Eliminar el rol incorrecto "profesor" si no hay usuarios usándolo
    if (profesorRoleId) {
      const usersWithProfesorRole = await client.query(
        'SELECT COUNT(*) as count FROM users WHERE role_id = $1',
        [profesorRoleId]
      );
      
      const count = parseInt(usersWithProfesorRole.rows[0].count);
      if (count === 0) {
        console.log(`\n🗑️  Eliminando rol incorrecto "profesor" (ID: ${profesorRoleId})...`);
        await client.query('DELETE FROM roles WHERE id = $1', [profesorRoleId]);
        console.log('✅ Rol "profesor" eliminado');
      } else {
        console.log(`\n⚠️  No se puede eliminar rol "profesor": ${count} usuario(s) aún lo usan`);
      }
    }

    console.log('\n🎉 Actualización completada!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

updateUserRole();