const { DataSource } = require('typeorm');
const path = require('path');

async function insertRole() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'Andres123',
    database: 'promanage_db',
    entities: [path.join(__dirname, 'src/**/*.entity{.ts,.js}')],
  });

  await dataSource.initialize();

  const result = await dataSource.query(
    `INSERT INTO roles (name) VALUES ('estudiante') ON CONFLICT (name) DO NOTHING RETURNING *;`
  );
  console.log('Role inserted or already exists:', result);

  await dataSource.destroy();
}

insertRole().catch(console.error);