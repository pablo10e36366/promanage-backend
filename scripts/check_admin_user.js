// Script to verify existence of admin@promanage.com (or legacy admin@example.com)
// and print its id, email and password hash.
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'promanage',
});

(async () => {
  try {
    await client.connect();
    const res = await client.query("SELECT id, email, password FROM users WHERE email = $1", ['admin@promanage.com']);
    if (res.rows.length === 0) {
      // Fallback for legacy admin@example.com
      const resLegacy = await client.query("SELECT id, email, password FROM users WHERE email = $1", ['admin@example.com']);
      console.log(JSON.stringify(resLegacy.rows, null, 2));
    } else {
      console.log(JSON.stringify(res.rows, null, 2));
    }
  } catch (err) {
    console.error('ERROR', err && err.message ? err.message : err);
  } finally {
    await client.end();
  }
})();

