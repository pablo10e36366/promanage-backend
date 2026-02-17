/*
Seed Admin, Docente, and Estudiante users into PostgreSQL in one go.
- Uses bcrypt for password hashing (salt rounds = 10).
- Looks up role IDs by name: admin, docente, colaborador.
- Skips existing users by email.
*/
require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

(async () => {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'promanage',
  });

  try {
    await client.connect();
    // Get role IDs
    const rolesRes = await client.query("SELECT name, id FROM roles WHERE name IN ('admin','docente','colaborador')");
    const roleMap = {};
    for (const r of rolesRes.rows) {
      roleMap[r.name] = r.id;
    }
    if (!roleMap.admin || !roleMap.docente || !roleMap.colaborador) {
      throw new Error('One or more required roles not found in DB');
    }

    const users = [
      { name: 'Administrador Promanage', email: 'admin@promanage.com', password: 'Admin123!', role: 'admin' },
      { name: 'Docente Promanage', email: 'docente@promanage.com', password: 'Docente123!', role: 'docente' },
      { name: 'Estudiante Promanage', email: 'estudiante@promanage.com', password: 'Estudiante123!', role: 'colaborador' },
    ];

    for (const u of users) {
      const exists = await client.query('SELECT id FROM users WHERE email = $1', [u.email]);
      if (exists.rows.length > 0) {
        console.log(`User exists: ${u.email}`);
        continue;
      }
      const hash = await bcrypt.hash(u.password, 10);
      await client.query(
        `INSERT INTO users (name, email, password, role_id) VALUES ($1,$2,$3,$4)`,
        [u.name, u.email, hash, roleMap[u.role]]
      );
      console.log(`Seeded ${u.email}`);
    }
  } catch (err) {
    console.error('Seed three users error:', err && err.message ? err.message : err);
  } finally {
    await client.end();
  }
})();

