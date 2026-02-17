require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'promanage_db',
  });

  try {
    await client.connect();
    // Ensure a set of common role names exist. Use ON CONFLICT to avoid duplicates.
    const roles = ['admin', 'docente', 'colaborador', 'profesor', 'estudiante', 'usuario'];
    for (const r of roles) {
      await client.query('INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [r]);
      console.log(`Ensured role: ${r}`);
    }
    console.log('Roles insertion completed');
  } catch (err) {
    console.error('Error inserting roles:', err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();

