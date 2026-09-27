import { Router } from 'express';
import { z } from 'zod';
import { one, query, pool } from '../db.js';
import { HttpError, buildUpdate, idParam, zCurrency, zDate, zOptText, zNotes } from '../util.js';

export const STATUS_GROUPS: Record<string, string[]> = {
  ongoing: ['active', 'on_hold'],
  opportunities: ['opportunity'],
  past: ['completed', 'lost', 'cancelled'],
};

export const MONTHLY_EQUIV = `CASE billing_cycle WHEN 'monthly' THEN amount WHEN 'quarterly' THEN amount/3.0 WHEN 'yearly' THEN amount/12.0 ELSE 0 END`;

export const PROJECT_SUMMARY = `
SELECT p.*, u.name AS owner_name,
  COALESCE(i.received, 0)::float AS income_received,
  COALESCE(i.expected, 0)::float AS income_expected,
  COALESCE(e.total, 0)::float AS expenses_total,
  (COALESCE(i.received, 0) - COALESCE(e.total, 0))::float AS balance,
  (COALESCE(a.burn, 0) + COALESCE(s.burn, 0))::float AS monthly_burn,
  COALESCE(a.team, 0)::int AS team_count,
  COALESCE(d.docs, 0)::int AS document_count
FROM projects p
LEFT JOIN users u ON u.id = p.owner_id
LEFT JOIN LATERAL (
  SELECT SUM(amount) FILTER (WHERE status = 'received') AS received,
         SUM(amount) FILTER (WHERE status = 'expected') AS expected
  FROM incomes WHERE project_id = p.id) i ON true
LEFT JOIN LATERAL (SELECT SUM(amount) AS total FROM expenses WHERE project_id = p.id) e ON true
LEFT JOIN LATERAL (
  SELECT SUM(monthly_cost) AS burn, COUNT(DISTINCT person_id) AS team FROM allocations
  WHERE project_id = p.id
    AND (start_date IS NULL OR start_date <= CURRENT_DATE)
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)) a ON true
LEFT JOIN LATERAL (
  SELECT SUM(${MONTHLY_EQUIV}) AS burn FROM subscriptions WHERE project_id = p.id AND active) s ON true
LEFT JOIN LATERAL (SELECT COUNT(*) AS docs FROM documents WHERE project_id = p.id) d ON true
`;

const projectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: zOptText,
  client: zOptText,
  description: zNotes(50000),
  status: z.enum(['opportunity', 'active', 'on_hold', 'completed', 'lost', 'cancelled']),
  currency: zCurrency,
  contract_value: z.coerce.number().min(0).nullable().optional(),
  probability: z.coerce.number().int().min(0).max(100).nullable().optional(),
  start_date: zDate,
  end_date: zDate,
  owner_id: z.coerce.number().int().positive().nullable().optional(),
  jira_url: zOptText,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const projectsRouter = Router();

projectsRouter.get('/', async (req, res) => {
  const group = String(req.query.group || '');
  const params: unknown[] = [];
  let where = '';
  if (STATUS_GROUPS[group]) {
    params.push(STATUS_GROUPS[group]);
    where = `WHERE p.status = ANY($1)`;
  }
  res.json(await query(`${PROJECT_SUMMARY} ${where} ORDER BY p.updated_at DESC`, params));
});

projectsRouter.post('/', async (req, res) => {
  const d = projectSchema.parse(req.body);
  const row = await one(
    `INSERT INTO projects (name, code, client, description, status, currency, contract_value, probability,
      start_date, end_date, owner_id, jira_url, color)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13,'#6366f1')) RETURNING id`,
    [d.name, d.code ?? null, d.client ?? null, d.description ?? '', d.status, d.currency, d.contract_value ?? null,
      d.probability ?? null, d.start_date ?? null, d.end_date ?? null, d.owner_id ?? req.user!.id, d.jira_url ?? null, d.color ?? null],
  );
  res.status(201).json(await one(`${PROJECT_SUMMARY} WHERE p.id = $1`, [row.id]));
});

projectsRouter.get('/:id', async (req, res) => {
  const p = await one(`${PROJECT_SUMMARY} WHERE p.id = $1`, [idParam(req)]);
  if (!p) throw new HttpError(404, 'Project not found');
  res.json(p);
});

projectsRouter.patch('/:id', async (req, res) => {
  const id = idParam(req);
  const d = projectSchema.partial().parse(req.body);
  const existing = await one('SELECT currency FROM projects WHERE id = $1', [id]);
  if (!existing) throw new HttpError(404, 'Project not found');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const q = buildUpdate('projects', id, d, 'updated_at = now()');
    await client.query(q.text, q.values);
    // Keep all project-linked money in the project's currency
    if (d.currency && d.currency !== existing.currency) {
      await client.query('UPDATE expenses SET currency = $1 WHERE project_id = $2', [d.currency, id]);
      await client.query('UPDATE subscriptions SET currency = $1 WHERE project_id = $2', [d.currency, id]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  res.json(await one(`${PROJECT_SUMMARY} WHERE p.id = $1`, [id]));
});

projectsRouter.delete('/:id', async (req, res) => {
  await query('DELETE FROM projects WHERE id = $1', [idParam(req)]);
  res.json({ ok: true });
});

// Monthly income vs expenses for the last 12 months (for charts)
projectsRouter.get('/:id/monthly', async (req, res) => {
  const id = idParam(req);
  res.json(
    await query(
      `WITH months AS (
         SELECT to_char(m, 'YYYY-MM') AS month
         FROM generate_series(date_trunc('month', CURRENT_DATE) - interval '11 months', date_trunc('month', CURRENT_DATE), interval '1 month') m)
       SELECT months.month,
         COALESCE((SELECT SUM(amount) FROM incomes WHERE project_id = $1 AND status = 'received' AND to_char(date,'YYYY-MM') = months.month), 0)::float AS income,
         COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = $1 AND to_char(date,'YYYY-MM') = months.month), 0)::float AS expense
       FROM months ORDER BY months.month`,
      [id],
    ),
  );
});

// Expense breakdown by category
projectsRouter.get('/:id/breakdown', async (req, res) => {
  res.json(
    await query(
      `SELECT category, SUM(amount)::float AS total FROM expenses WHERE project_id = $1 GROUP BY category ORDER BY total DESC`,
      [idParam(req)],
    ),
  );
});

// Record payroll: creates one salary expense per allocation active in the given month (idempotent)
projectsRouter.post('/:id/payroll', async (req, res) => {
  const id = idParam(req);
  const { period, date } = z
    .object({ period: z.string().regex(/^\d{4}-\d{2}$/, 'must be YYYY-MM'), date: zDate })
    .parse(req.body);
  const project = await one('SELECT currency FROM projects WHERE id = $1', [id]);
  if (!project) throw new HttpError(404, 'Project not found');
  const monthStart = `${period}-01`;
  const created = await query(
    `INSERT INTO expenses (project_id, category, description, amount, currency, date, person_id, allocation_id, period, created_by)
     SELECT a.project_id, 'salary', 'Salary – ' || pe.name || ' (' || to_char($2::date, 'Mon YYYY') || ')',
            a.monthly_cost, $3, COALESCE($4::date, ($2::date + interval '1 month - 1 day')::date), a.person_id, a.id, $5, $6
     FROM allocations a JOIN people pe ON pe.id = a.person_id
     WHERE a.project_id = $1 AND a.monthly_cost > 0
       AND (a.start_date IS NULL OR a.start_date <= ($2::date + interval '1 month - 1 day'))
       AND (a.end_date IS NULL OR a.end_date >= $2::date)
     ON CONFLICT (allocation_id, period) WHERE allocation_id IS NOT NULL AND period IS NOT NULL DO NOTHING
     RETURNING id`,
    [id, monthStart, project.currency, date ?? null, period, req.user!.id],
  );
  res.json({ created: created.length });
});

// ---- Notes / activity log ----
projectsRouter.get('/:id/notes', async (req, res) => {
  res.json(
    await query(
      `SELECT n.*, u.name AS author_name FROM project_notes n LEFT JOIN users u ON u.id = n.author_id
       WHERE project_id = $1 ORDER BY created_at DESC`,
      [idParam(req)],
    ),
  );
});

projectsRouter.post('/:id/notes', async (req, res) => {
  const { body } = z.object({ body: z.string().trim().min(1).max(20000) }).parse(req.body);
  const row = await one('INSERT INTO project_notes (project_id, body, author_id) VALUES ($1,$2,$3) RETURNING *', [
    idParam(req),
    body,
    req.user!.id,
  ]);
  res.status(201).json({ ...row, author_name: req.user!.name });
});

projectsRouter.delete('/:id/notes/:noteId', async (req, res) => {
  await query('DELETE FROM project_notes WHERE id = $1 AND project_id = $2', [idParam(req, 'noteId'), idParam(req)]);
  res.json({ ok: true });
});
