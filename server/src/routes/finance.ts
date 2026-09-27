import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db.js';
import { HttpError, buildUpdate, idParam, zCurrency, zDate, zMoney, zNotes } from '../util.js';

const EXPENSE_CATEGORIES = ['salary', 'subscription', 'contractor', 'software', 'hardware', 'travel', 'marketing', 'office', 'tax', 'other'] as const;

async function projectCurrency(projectId: number | null | undefined): Promise<string | null> {
  if (!projectId) return null;
  const p = await one<{ currency: string }>('SELECT currency FROM projects WHERE id = $1', [projectId]);
  if (!p) throw new HttpError(400, 'Project not found');
  return p.currency;
}

// ---------------- Incomes ----------------
const incomeSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  description: z.string().trim().min(1).max(500),
  reference: z.string().trim().max(200).nullable().optional(),
  amount: zMoney,
  status: z.enum(['received', 'expected']).default('received'),
  date: zDate,
  notes: zNotes(),
});

export const incomesRouter = Router();

incomesRouter.get('/', async (req, res) => {
  const params: unknown[] = [];
  const where: string[] = [];
  if (req.query.project_id) {
    params.push(Number(req.query.project_id));
    where.push(`i.project_id = $${params.length}`);
  }
  if (req.query.from) {
    params.push(req.query.from);
    where.push(`i.date >= $${params.length}`);
  }
  if (req.query.to) {
    params.push(req.query.to);
    where.push(`i.date <= $${params.length}`);
  }
  res.json(
    await query(
      `SELECT i.*, p.currency, p.name AS project_name, p.color AS project_color, u.name AS created_by_name
       FROM incomes i JOIN projects p ON p.id = i.project_id LEFT JOIN users u ON u.id = i.created_by
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.date DESC, i.id DESC`,
      params,
    ),
  );
});

incomesRouter.post('/', async (req, res) => {
  const d = incomeSchema.parse(req.body);
  await projectCurrency(d.project_id);
  const row = await one(
    `INSERT INTO incomes (project_id, description, reference, amount, status, date, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, CURRENT_DATE),$7,$8) RETURNING *`,
    [d.project_id, d.description, d.reference ?? null, d.amount, d.status, d.date ?? null, d.notes ?? '', req.user!.id],
  );
  res.status(201).json(row);
});

incomesRouter.patch('/:id', async (req, res) => {
  const d = incomeSchema.partial().omit({ project_id: true }).parse(req.body);
  const q = buildUpdate('incomes', idParam(req), d);
  const rows = await query(q.text, q.values);
  if (!rows[0]) throw new HttpError(404, 'Not found');
  res.json(rows[0]);
});

incomesRouter.delete('/:id', async (req, res) => {
  await query('DELETE FROM incomes WHERE id = $1', [idParam(req)]);
  res.json({ ok: true });
});

// ---------------- Expenses ----------------
const expenseSchema = z.object({
  project_id: z.coerce.number().int().positive().nullable().optional(),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(1).max(500),
  amount: zMoney,
  currency: zCurrency.optional(),
  date: zDate,
  person_id: z.coerce.number().int().positive().nullable().optional(),
  subscription_id: z.coerce.number().int().positive().nullable().optional(),
  notes: zNotes(),
});

export const expensesRouter = Router();

expensesRouter.get('/', async (req, res) => {
  const params: unknown[] = [];
  const where: string[] = [];
  if (req.query.project_id) {
    params.push(Number(req.query.project_id));
    where.push(`e.project_id = $${params.length}`);
  }
  if (req.query.overall === '1') where.push('e.project_id IS NULL');
  if (req.query.category) {
    params.push(req.query.category);
    where.push(`e.category = $${params.length}`);
  }
  if (req.query.person_id) {
    params.push(Number(req.query.person_id));
    where.push(`e.person_id = $${params.length}`);
  }
  if (req.query.from) {
    params.push(req.query.from);
    where.push(`e.date >= $${params.length}`);
  }
  if (req.query.to) {
    params.push(req.query.to);
    where.push(`e.date <= $${params.length}`);
  }
  res.json(
    await query(
      `SELECT e.*, p.name AS project_name, p.color AS project_color, pe.name AS person_name, s.name AS subscription_name,
              u.name AS created_by_name
       FROM expenses e
       LEFT JOIN projects p ON p.id = e.project_id
       LEFT JOIN people pe ON pe.id = e.person_id
       LEFT JOIN subscriptions s ON s.id = e.subscription_id
       LEFT JOIN users u ON u.id = e.created_by
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY e.date DESC, e.id DESC`,
      params,
    ),
  );
});

expensesRouter.post('/', async (req, res) => {
  const d = expenseSchema.parse(req.body);
  const currency = (await projectCurrency(d.project_id)) ?? d.currency;
  if (!currency) throw new HttpError(400, 'currency is required for overall expenses');
  const row = await one(
    `INSERT INTO expenses (project_id, category, description, amount, currency, date, person_id, subscription_id, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, CURRENT_DATE),$7,$8,$9,$10) RETURNING *`,
    [d.project_id ?? null, d.category, d.description, d.amount, currency, d.date ?? null, d.person_id ?? null,
      d.subscription_id ?? null, d.notes ?? '', req.user!.id],
  );
  res.status(201).json(row);
});

expensesRouter.patch('/:id', async (req, res) => {
  const id = idParam(req);
  const d = expenseSchema.partial().parse(req.body);
  const patch: Record<string, unknown> = { ...d };
  if (d.project_id !== undefined) {
    const cur = await projectCurrency(d.project_id);
    if (cur) patch.currency = cur;
  }
  const q = buildUpdate('expenses', id, patch);
  const rows = await query(q.text, q.values);
  if (!rows[0]) throw new HttpError(404, 'Not found');
  res.json(rows[0]);
});

expensesRouter.delete('/:id', async (req, res) => {
  await query('DELETE FROM expenses WHERE id = $1', [idParam(req)]);
  res.json({ ok: true });
});
