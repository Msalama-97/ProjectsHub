import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db.js';
import { HttpError, buildUpdate, idParam, zCurrency, zDate, zMoney, zNotes } from '../util.js';

const personSchema = z.object({
  name: z.string().trim().min(1).max(200),
  title: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
  monthly_salary: zMoney.default(0),
  currency: zCurrency,
  employment_type: z.enum(['full_time', 'part_time', 'contractor', 'freelancer']).default('full_time'),
  active: z.boolean().default(true),
  notes: zNotes(),
});

const ACTIVE_ALLOC = `(a.start_date IS NULL OR a.start_date <= CURRENT_DATE) AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)`;

export const peopleRouter = Router();

peopleRouter.get('/', async (_req, res) => {
  res.json(
    await query(
      `SELECT pe.*,
        COALESCE((SELECT SUM(a.percent) FROM allocations a JOIN projects p ON p.id = a.project_id
                  WHERE a.person_id = pe.id AND ${ACTIVE_ALLOC} AND p.status IN ('active','on_hold')), 0)::int AS allocated_percent,
        COALESCE((SELECT json_agg(json_build_object('id', a.id, 'project_id', p.id, 'project_name', p.name, 'project_color', p.color,
                    'percent', a.percent, 'role', a.role, 'monthly_cost', a.monthly_cost, 'currency', p.currency) ORDER BY a.percent DESC)
                  FROM allocations a JOIN projects p ON p.id = a.project_id
                  WHERE a.person_id = pe.id AND ${ACTIVE_ALLOC} AND p.status IN ('active','on_hold','opportunity')), '[]') AS allocations,
        COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.person_id = pe.id AND e.category = 'salary'), 0)::float AS total_paid
       FROM people pe ORDER BY pe.active DESC, pe.name`,
    ),
  );
});

peopleRouter.post('/', async (req, res) => {
  const d = personSchema.parse(req.body);
  res.status(201).json(
    await one(
      `INSERT INTO people (name, title, email, monthly_salary, currency, employment_type, active, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [d.name, d.title ?? null, d.email ?? null, d.monthly_salary, d.currency, d.employment_type, d.active, d.notes ?? ''],
    ),
  );
});

peopleRouter.patch('/:id', async (req, res) => {
  const q = buildUpdate('people', idParam(req), personSchema.partial().parse(req.body));
  const rows = await query(q.text, q.values);
  if (!rows[0]) throw new HttpError(404, 'Not found');
  res.json(rows[0]);
});

peopleRouter.delete('/:id', async (req, res) => {
  await query('DELETE FROM people WHERE id = $1', [idParam(req)]);
  res.json({ ok: true });
});

// ---------------- Allocations ----------------
const allocationSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  person_id: z.coerce.number().int().positive(),
  role: z.string().trim().max(200).nullable().optional(),
  percent: z.coerce.number().int().min(0).max(100).default(100),
  monthly_cost: zMoney.default(0),
  start_date: zDate,
  end_date: zDate,
  notes: zNotes(),
});

export const allocationsRouter = Router();

allocationsRouter.get('/', async (req, res) => {
  const pid = Number(req.query.project_id);
  if (!pid) throw new HttpError(400, 'project_id is required');
  res.json(
    await query(
      `SELECT a.*, pe.name AS person_name, pe.title AS person_title, pe.monthly_salary, pe.currency AS salary_currency,
              pe.employment_type, (${ACTIVE_ALLOC}) AS is_current
       FROM allocations a JOIN people pe ON pe.id = a.person_id WHERE a.project_id = $1
       ORDER BY is_current DESC, pe.name`,
      [pid],
    ),
  );
});

allocationsRouter.post('/', async (req, res) => {
  const d = allocationSchema.parse(req.body);
  res.status(201).json(
    await one(
      `INSERT INTO allocations (project_id, person_id, role, percent, monthly_cost, start_date, end_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [d.project_id, d.person_id, d.role ?? null, d.percent, d.monthly_cost, d.start_date ?? null, d.end_date ?? null, d.notes ?? ''],
    ),
  );
});

allocationsRouter.patch('/:id', async (req, res) => {
  const d = allocationSchema.partial().omit({ project_id: true }).parse(req.body);
  const q = buildUpdate('allocations', idParam(req), d);
  const rows = await query(q.text, q.values);
  if (!rows[0]) throw new HttpError(404, 'Not found');
  res.json(rows[0]);
});

allocationsRouter.delete('/:id', async (req, res) => {
  await query('DELETE FROM allocations WHERE id = $1', [idParam(req)]);
  res.json({ ok: true });
});
