import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Return NUMERIC and BIGINT as JS numbers, DATE as plain 'YYYY-MM-DD' strings
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
pg.types.setTypeParser(1082, (v) => v);

export let pool: pg.Pool;
let shutdownEmbedded: (() => Promise<void>) | null = null;

/** Connect to PostgreSQL — or start the embedded one when EMBEDDED_DB=true. */
export async function initDb() {
  if (!config.embeddedDb) {
    pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
    return;
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  fs.mkdirSync(config.embeddedDbDir, { recursive: true });
  const db = await PGlite.create(config.embeddedDbDir);
  const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: config.embeddedDbPort });
  await server.start();
  console.log(`Embedded database ready (data in ${config.embeddedDbDir})`);
  // PGlite is single-connection: keep one pooled connection
  pool = new pg.Pool({ connectionString: `postgres://postgres@127.0.0.1:${config.embeddedDbPort}/postgres`, max: 1 });
  shutdownEmbedded = async () => {
    await pool.end().catch(() => {});
    await server.stop().catch(() => {});
    await db.close().catch(() => {});
  };
}

export async function closeDb() {
  if (shutdownEmbedded) await shutdownEmbedded();
  else await pool?.end().catch(() => {});
}

export async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params as any[]);
  return res.rows as T[];
}

export async function one<T = any>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

export async function waitForDb(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (e) {
      console.log(`Waiting for database... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Database not reachable');
}

export async function migrate(dir: string) {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const applied = new Set((await query<{ name: string }>('SELECT name FROM schema_migrations')).map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied migration ${file}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
