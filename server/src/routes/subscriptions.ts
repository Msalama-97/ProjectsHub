import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db.js';
import { HttpError, buildUpdate, idParam, zCurrency, zDate, zMoney, zNotes } from '../util.js';
import { MONTHLY_EQUIV } from './projects.js';

const subSchema = z.object({
  project_id: z.coerce.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  vendor: z.string().trim().max(200).nullable().optional(),
  amount: zMoney,
  currency: zCurrency.optional(),
  billing_cycle: z.enum(['monthly', 'quarterly', 'yearly', 'one_time']).default('monthly'),
  start_date: zDate,
  next_renewal: zDate,
  active: z.boolean().default(true),
  notes: zNotes(),
});

async function currencyFor(projectId: number | null | undefined, fallback?: string) {
  if (projectId) {
    const p = await one<{ currency: string }>('SELECT currency FROM projects WHERE id = $1', [projectId]);
    if (!p) throw new HttpError(400, 'Project not found');
    return p.currency;
  }
  if (!fallback) throw new HttpError(400, 'currency is required for company-wide subscriptions');
  return fallback;
}

export const subscriptionsRouter = Router();

subscriptionsRouter.get('/', async (req, res) => {
  const params: unknown[] = [];
  let where = '';
  if (req.query.project_id) {
    params.push(Number(req.query.project_id));
    where = 'WHERE s.project_id = $1';
  } else if (req.query.scope === 'overall') {
    where = 'WHERE s.project_id IS NULL';
  }
  res.json(
    await query(
      `SELECT s.*, (${MONTHLY_EQUIV.replace(/billing_cycle|amount/g, (m) => 's.' + m)})::float AS monthly_equivalent,
              p.name AS project_name, p.color AS project_color,
              (SELECT MAX(date) FROM expenses e WHERE e.subscription_id = s.id) AS last_paid,
              COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.subscription_id = s.id), 0)::float AS total_paid
       FROM subscriptions s LEFT JOIN projects p ON p.id = s.project_id
       ${where} ORDER BY s.active DESC, s.next_renewal NULLS LAST, s.name`,
      params,
    ),
  );
});

subscriptionsRouter.post('/', async (req, res) => {
  const d = subSchema.parse(req.body);
  const currency = await currencyFor(d.project_id, d.currency);
  res.status(201).json(
    await one(
      `INSERT INTO subscriptions (project_id, name, vendor, amount, currency, billing_cycle, start_date, next_renewal, active, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [d.project_id ?? null, d.name, d.vendor ?? null, d.amount, currency, d.billing_cycle, d.start_date ?? null,
        d.next_renewal ?? null, d.active, d.notes ?? ''],
    ),
  );
});

subscriptionsRouter.patch('/:id', async (req, res) => {
  const id = idParam(req);
  const d = subSchema.partial().parse(req.body);
  const patch: Record<string, unknown> = { ...d };
  if (d.project_id !== undefined) patch.currency = await currencyFor(d.project_id, d.currency ?? (await one('SELECT currency FROM subscriptions WHERE id=$1', [id]))?.currency);
  const q = buildUpdate('subscriptions', id, patch);
  const rows = await query(q.text, q.values);
  if (!rows[0]) throw new HttpError(404, 'Not found');
  res.json(rows[0]);
});

subscriptionsRouter.delete('/:id', async (req, res) => {
  await query('DELETE FROM subscriptions WHERE id = $1', [idParam(req)]);
  res.json({ ok: true });
});

// Record a payment -> creates an expense and moves the renewal date forward
subscriptionsRouter.post('/:id/pay', async (req, res) => {
  const id = idParam(req);
  const { date, amount } = z.object({ date: zDate, amount: zMoney.optional() }).parse(req.body);
  const s = await one('SELECT * FROM subscriptions WHERE id = $1', [id]);
  if (!s) throw new HttpError(404, 'Not found');
  const expense = await one(
    `INSERT INTO expenses (project_id, category, description, amount, currency, date, subscription_id, created_by)
     VALUES ($1,'subscription',$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6,$7) RETURNING *`,
    [s.project_id, `${s.name}${s.vendor ? ' – ' + s.vendor : ''}`, amount ?? s.amount, s.currency, date ?? null, id, req.user!.id],
  );
  const step = { monthly: '1 month', quarterly: '3 months', yearly: '1 year' }[s.billing_cycle as string];
  if (step) {
    await query(
      `UPDATE subscriptions SET next_renewal = (COALESCE(next_renewal, $2::date) + $3::interval)::date WHERE id = $1`,
      [id, expense.date, step],
    );
  } else {
    await query('UPDATE subscriptions SET active = false WHERE id = $1', [id]);
  }
  res.status(201).json(expense);
});
