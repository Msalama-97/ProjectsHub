import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const env = process.env;

export const config = {
  port: parseInt(env.PORT || '8080', 10),
  databaseUrl:
    env.DATABASE_URL ||
    `postgres://${env.POSTGRES_USER || 'projecthub'}:${env.POSTGRES_PASSWORD || 'projecthub'}@${env.POSTGRES_HOST || 'localhost'}:${env.POSTGRES_PORT || '5432'}/${env.POSTGRES_DB || 'projecthub'}`,
  adminEmail: (env.ADMIN_EMAIL || 'admin@example.com').toLowerCase(),
  adminPassword: env.ADMIN_PASSWORD || 'admin12345',
  adminName: env.ADMIN_NAME || 'Admin',
  uploadDir: env.UPLOAD_DIR || path.resolve('uploads'),
  maxUploadMb: parseInt(env.MAX_UPLOAD_MB || '50', 10),
  cookieSecure: env.COOKIE_SECURE === 'true',
  webDir: env.WEB_DIR || path.resolve('public'),
  migrationsDir: env.MIGRATIONS_DIR || path.resolve('migrations'),
  // Embedded mode: runs PostgreSQL (PGlite) inside the app process — no Docker/Postgres install needed.
  embeddedDb: env.EMBEDDED_DB === 'true',
  embeddedDbDir: env.EMBEDDED_DB_DIR || path.resolve('data/db'),
  embeddedDbPort: parseInt(env.EMBEDDED_DB_PORT || '54329', 10),
};

/**
 * Session signing secret. Uses JWT_SECRET if set; otherwise generates a random one once
 * and stores it next to the uploads folder so sessions survive restarts.
 */
function loadSecret(): string {
  if (env.JWT_SECRET && env.JWT_SECRET.length >= 16) return env.JWT_SECRET;
  const file = path.join(path.dirname(config.uploadDir), '.session-secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(48).toString('hex');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}

export const jwtSecret = loadSecret();
