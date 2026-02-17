/*
Seed a dedicated admin user into PostgreSQL using node-postgres and bcrypt.
This is a fresh seed not tied to TypeORM migrations, intended to bootstrap
an admin for authentication tests.
Password is plaintext 'admin123' hashed with bcrypt(10).
This script will skip if the user already exists.
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
    const resRole = await client.query("SELECT id FROM roles WHERE name = 'admin' LIMIT 1");
    if (resRole.rows.length === 0) {
      throw new Error('Admin role not found in DB');
    }
    const roleId = resRole.rows[0].id;
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (name, email, password, role_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING;`,
      ['Administrador', 'admin@example.com', hashedPassword, roleId]
    );
    console.log('Seeded admin@example.com');
  } catch (err) {
    console.error('Seed admin error:', err && err.message ? err.message : err);
  } finally {
    await client.end();
  }
})();

