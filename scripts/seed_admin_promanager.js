/*
Seed an administrator with email admin@promanage.com using a direct DB insert.
This script looks up the admin role id and inserts the user if not exists.
Password is hashed with bcrypt (salt rounds = 10).
*/
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
    // Fetch admin role id
    const resRole = await client.query("SELECT id FROM roles WHERE name = 'admin' LIMIT 1");
    if (resRole.rows.length === 0) {
      throw new Error('Admin role not found in DB');
    }
    const roleId = resRole.rows[0].id;
    const hashedPassword = await bcrypt.hash('admin123', 10);
    // Insert admin@promanage.com if not exists
    await client.query(
      `INSERT INTO users (name, email, password, role_id) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING;`,
      ['Administrador Promanage', 'admin@promanage.com', hashedPassword, roleId],
    );
    console.log('Seeded admin@promanage.com');
  } catch (err) {
    console.error('Seed admin (admin@promanage.com) error:', err && err.message ? err.message : err);
  } finally {
    await client.end();
  }
})();

