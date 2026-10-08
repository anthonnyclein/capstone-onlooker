import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/cpms_db';
const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1') || connectionString.includes('@db:');

export const pool = new Pool({
  connectionString,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected error on idle client:', err);
});

export async function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}

/**
 * Initializes the database schema from schema.sql.
 */
export async function initDb(): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const ddl = await fs.readFile(schemaPath, 'utf8');
  await pool.query(ddl);
  await pool.query('ALTER TABLE submission_versions ADD COLUMN IF NOT EXISTS file_data_url TEXT;');
  console.log('DB Schema is verified and ready.');
}

