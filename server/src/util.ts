import type { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}

export function idParam(req: Request, name = 'id'): number {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Invalid id');
  return n;
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return res.status(400).json({ error: `${issue.path.join('.') || 'input'}: ${issue.message}` });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.code === '23505') return res.status(409).json({ error: 'This record already exists' });
  if (err?.code === '23503') return res.status(400).json({ error: 'Related record not found' });
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File is too large' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
}

// Reusable zod helpers
export const zDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));
export const zMoney = z.coerce.number().min(0).max(1e12);
export const zCurrency = z.string().trim().toUpperCase().length(3);
export const zOptText = z.string().trim().max(5000).nullable().optional();
/** Optional free text stored as NOT NULL '' — accepts missing, null or empty. */
export const zNotes = (max = 5000) =>
  z.string().max(max).nullish().transform((v) => (v === null ? '' : v));

/** Build a dynamic UPDATE statement from a partial object. */
export function buildUpdate(table: string, id: number, data: Record<string, unknown>, extra = '') {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  if (!keys.length) throw new HttpError(400, 'Nothing to update');
  const sets = keys.map((k, i) => `${k} = $${i + 1}`);
  if (extra) sets.push(extra);
  return {
    text: `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
    values: [...keys.map((k) => data[k]), id],
  };
}
