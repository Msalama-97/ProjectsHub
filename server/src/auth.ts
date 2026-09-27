import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config, jwtSecret } from './config.js';
import { one, query } from './db.js';
import { HttpError, buildUpdate, idParam } from './util.js';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'member';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const COOKIE = 'ph_session';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function issue(req: Request, res: Response, user: AuthUser) {
  const token = jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '14d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Secure when served over HTTPS (directly or behind a proxy like Coolify/Traefik)
    secure: config.cookieSecure || req.secure,
    maxAge: MAX_AGE_MS,
  });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next(new HttpError(401, 'Not signed in'));
  try {
    const payload = jwt.verify(token, jwtSecret) as unknown as { sub: number };
    const user = await one<AuthUser>('SELECT id, email, name, role FROM users WHERE id = $1', [payload.sub]);
    if (!user) return next(new HttpError(401, 'Not signed in'));
    req.user = user;
    next();
  } catch {
    next(new HttpError(401, 'Session expired'));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Admins only'));
  next();
}

export async function ensureAdmin() {
  const count = await one<{ n: number }>('SELECT count(*)::int AS n FROM users');
  if (count && count.n > 0) return;
  const hash = await bcrypt.hash(config.adminPassword, 10);
  await query('INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,$4)', [
    config.adminEmail,
    config.adminName,
    hash,
    'admin',
  ]);
  console.log(`Created initial admin user: ${config.adminEmail}`);
}

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = z
    .object({ email: z.string().trim().toLowerCase(), password: z.string().min(1) })
    .parse(req.body);
  const row = await one<AuthUser & { password_hash: string }>(
    'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
    [email],
  );
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    throw new HttpError(401, 'Wrong email or password');
  }
  const { password_hash, ...user } = row;
  issue(req, res, user);
  res.json(user);
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => res.json(req.user));

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const { current, next } = z
    .object({ current: z.string().min(1), next: z.string().min(8, 'must be at least 8 characters') })
    .parse(req.body);
  const row = await one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
  if (!row || !(await bcrypt.compare(current, row.password_hash))) throw new HttpError(400, 'Current password is wrong');
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(next, 10), req.user!.id]);
  res.json({ ok: true });
});

// ---- User management (admin only) ----
export const usersRouter = Router();

usersRouter.get('/', async (_req, res) => {
  res.json(await query('SELECT id, email, name, role, created_at FROM users ORDER BY created_at'));
});

usersRouter.post('/', requireAdmin, async (req, res) => {
  const data = z
    .object({
      email: z.string().trim().toLowerCase().email(),
      name: z.string().trim().min(1),
      password: z.string().min(8, 'must be at least 8 characters'),
      role: z.enum(['admin', 'member']).default('member'),
    })
    .parse(req.body);
  const user = await one(
    'INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, email, name, role, created_at',
    [data.email, data.name, await bcrypt.hash(data.password, 10), data.role],
  );
  res.status(201).json(user);
});

usersRouter.patch('/:id', requireAdmin, async (req, res) => {
  const id = idParam(req);
  const data = z
    .object({
      name: z.string().trim().min(1).optional(),
      role: z.enum(['admin', 'member']).optional(),
      password: z.string().min(8, 'must be at least 8 characters').optional(),
    })
    .parse(req.body);
  const patch: Record<string, unknown> = { name: data.name, role: data.role };
  if (data.password) patch.password_hash = await bcrypt.hash(data.password, 10);
  if (data.role === 'member' && id === req.user!.id) throw new HttpError(400, "You can't remove your own admin role");
  const q = buildUpdate('users', id, patch);
  const rows = await query(q.text.replace('RETURNING *', 'RETURNING id, email, name, role, created_at'), q.values);
  if (!rows[0]) throw new HttpError(404, 'User not found');
  res.json(rows[0]);
});

usersRouter.delete('/:id', requireAdmin, async (req, res) => {
  const id = idParam(req);
  if (id === req.user!.id) throw new HttpError(400, "You can't delete yourself");
  await query('DELETE FROM users WHERE id = $1', [id]);
  res.json({ ok: true });
});
