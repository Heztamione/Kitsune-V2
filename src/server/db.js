const fs = require('fs');
const path = require('path');
const config = require('./config');

let pool, migrate, transaction;

if (config.demoMode) {
  // In-memory fallback — no PostgreSQL required. Data does NOT persist across restarts.
  const memory = require('./memory-db');
  pool = memory.pool;
  migrate = memory.migrate;
  transaction = memory.transaction;
} else {
  const { Pool } = require('pg');
  const pgPool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
    max: Number(process.env.DB_POOL_SIZE || 20),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool = pgPool;

  migrate = async function migrate() {
    const client = await pgPool.connect();
    try {
      await client.query('SELECT pg_advisory_lock($1)', [842019]);
      await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      const applied1 = await client.query('SELECT 1 FROM schema_migrations WHERE version = 1');
      if (!applied1.rowCount) {
        await client.query('BEGIN');
        await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
        await client.query('INSERT INTO schema_migrations(version) VALUES (1)');
        await client.query('COMMIT');
      }
      const applied2 = await client.query('SELECT 1 FROM schema_migrations WHERE version = 2');
      if (!applied2.rowCount) {
        await client.query('BEGIN');
        await client.query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS remember boolean NOT NULL DEFAULT false');
        await client.query('INSERT INTO schema_migrations(version) VALUES (2)');
        await client.query('COMMIT');
      }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [842019]).catch(() => {});
      client.release();
    }
  };

  transaction = async function transaction(fn) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
}

module.exports = { pool, migrate, transaction };
