import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { join } from 'path';

async function runMigrations() {
  const connectionString =
    process.env.DATABASE_URL || 'postgres://app:app@localhost:5432/app';

  console.log('[migrate] Connecting to database...');

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  const db = drizzle(pool);

  const migrationsFolder = join(__dirname, 'migrations');
  console.log(`[migrate] Running migrations from ${migrationsFolder}`);

  await migrate(db, { migrationsFolder });

  console.log('[migrate] Migrations complete.');
  await pool.end();
}

runMigrations().catch((err) => {
  console.error('[migrate] Migration failed:', err);
  process.exit(1);
});
