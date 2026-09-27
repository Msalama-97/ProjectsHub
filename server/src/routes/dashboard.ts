import { Router } from 'express';
import { query } from '../db.js';
import { MONTHLY_EQUIV } from './projects.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (_req, res) => {
  const [counts, currencies, monthly, overheadSubs, overheadExpenses, renewals, recent] = await Promise.all([
    query(`SELECT
        COUNT(*) FILTER (WHERE status IN ('active','on_hold'))::int AS ongoing,
        COUNT(*) FILTER (WHERE status = 'opportunity')::int AS opportunities,
        COUNT(*) FILTER (WHERE status IN ('completed','lost','cancelled'))::int AS past,
        (SELECT COUNT(*) FROM people WHERE active)::int AS people
      FROM projects`),

    // Per-currency totals across projects (no FX conversion — money is grouped by currency)
    query(`WITH cur AS (
        SELECT currency FROM projects UNION SELECT currency FROM expenses UNION SELECT currency FROM subscriptions)
      SELECT cur.currency,
        (SELECT COUNT(*) FROM projects WHERE currency = cur.currency)::int AS project_count,
        COALESCE((SELECT SUM(i.amount) FROM incomes i JOIN projects p ON p.id = i.project_id
                  WHERE p.currency = cur.currency AND i.status = 'received'), 0)::float AS income_received,
        COALESCE((SELECT SUM(i.amount) FROM incomes i JOIN projects p ON p.id = i.project_id
                  WHERE p.currency = cur.currency AND i.status = 'expected'), 0)::float AS income_expected,
        COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.project_id IS NOT NULL AND e.currency = cur.currency), 0)::float AS project_expenses,
        COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.project_id IS NULL AND e.currency = cur.currency), 0)::float AS overhead_expenses,
        COALESCE((SELECT SUM(a.monthly_cost) FROM allocations a JOIN projects p ON p.id = a.project_id
                  WHERE p.currency = cur.currency AND p.status IN ('active','on_hold')
                    AND (a.start_date IS NULL OR a.start_date <= CURRENT_DATE)
                    AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)), 0)::float AS monthly_payroll,
        COALESCE((SELECT SUM(${MONTHLY_EQUIV}) FROM subscriptions WHERE active AND currency = cur.currency), 0)::float AS monthly_subscriptions,
        COALESCE((SELECT SUM(contract_value) FROM projects WHERE status = 'opportunity' AND currency = cur.currency), 0)::float AS pipeline_value,
        COALESCE((SELECT SUM(contract_value * COALESCE(probability, 50) / 100.0) FROM projects
                  WHERE status = 'opportunity' AND currency = cur.currency), 0)::float AS pipeline_weighted
      FROM cur ORDER BY cur.currency`),

    query(`WITH months AS (
        SELECT to_char(m, 'YYYY-MM') AS month FROM generate_series(
          date_trunc('month', CURRENT_DATE) - interval '11 months', date_trunc('month', CURRENT_DATE), interval '1 month') m)
      SELECT months.month, c.currency,
        COALESCE((SELECT SUM(i.amount) FROM incomes i JOIN projects p ON p.id = i.project_id
                  WHERE i.status = 'received' AND p.currency = c.currency AND to_char(i.date,'YYYY-MM') = months.month), 0)::float AS income,
        COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.currency = c.currency AND to_char(e.date,'YYYY-MM') = months.month), 0)::float AS expense
      FROM months CROSS JOIN (SELECT DISTINCT currency FROM projects UNION SELECT DISTINCT currency FROM expenses) c
      ORDER BY c.currency, months.month`),

    query(`SELECT currency, SUM(${MONTHLY_EQUIV})::float AS monthly FROM subscriptions WHERE active AND project_id IS NULL GROUP BY currency`),

    query(`SELECT currency, category, SUM(amount)::float AS total FROM expenses
           WHERE project_id IS NULL AND date >= date_trunc('month', CURRENT_DATE) GROUP BY currency, category`),

    query(`SELECT s.id, s.name, s.vendor, s.amount, s.currency, s.billing_cycle, s.next_renewal, p.name AS project_name, p.id AS project_id
           FROM subscriptions s LEFT JOIN projects p ON p.id = s.project_id
           WHERE s.active AND s.next_renewal IS NOT NULL AND s.next_renewal <= CURRENT_DATE + 30
           ORDER BY s.next_renewal LIMIT 8`),

    query(`(SELECT 'income' AS type, i.id, i.date, i.description, i.amount::float, p.currency, p.id AS project_id, p.name AS project_name,
                   p.color AS project_color, i.status AS extra, i.created_at
            FROM incomes i JOIN projects p ON p.id = i.project_id)
           UNION ALL
           (SELECT 'expense', e.id, e.date, e.description, e.amount::float, e.currency, p.id, p.name, p.color, e.category, e.created_at
            FROM expenses e LEFT JOIN projects p ON p.id = e.project_id)
           ORDER BY created_at DESC LIMIT 10`),
  ]);

  res.json({
    counts: counts[0],
    currencies,
    monthly,
    overheadSubscriptions: overheadSubs,
    overheadExpenses,
    renewals,
    recent,
  });
});
