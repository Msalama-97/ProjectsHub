import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CATEGORY, money, monthLabel } from '../lib/format';
import type { ExpenseCategory } from '../lib/api';

function readVars() {
  const cs = getComputedStyle(document.documentElement);
  const g = (n: string) => cs.getPropertyValue(n).trim();
  return {
    in: g('--ph-series-in'),
    out: g('--ph-series-out'),
    grid: g('--ph-line'),
    faint: g('--ph-faint'),
    muted: g('--ph-muted'),
    surface: g('--ph-surface'),
    subtle: g('--ph-subtle'),
  };
}

/** Theme-aware chart colors (re-read when light/dark mode toggles). */
export function useChartColors() {
  const [c, setC] = useState(readVars);
  useEffect(() => {
    const obs = new MutationObserver(() => setC(readVars()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return c;
}

function Legend({ colors }: { colors: ReturnType<typeof useChartColors> }) {
  return (
    <div className="flex items-center gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm" style={{ background: colors.in }} /> Money in
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm" style={{ background: colors.out }} /> Money out
      </span>
    </div>
  );
}

export function CashflowChart({ data, currency, height = 240 }: { data: { month: string; income: number; expense: number }[]; currency: string; height?: number }) {
  const c = useChartColors();
  const empty = data.every((d) => !d.income && !d.expense);
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Legend colors={c} />
      </div>
      <div style={{ height }} className="relative">
        {empty && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-[13px] text-faint">No transactions in the last 12 months yet</div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="0" />
            <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} tick={{ fill: c.faint, fontSize: 11 }} dy={6} />
            <YAxis
              tickFormatter={(v) => money(v, currency, { compact: true })}
              tickLine={false}
              axisLine={false}
              width={64}
              tick={{ fill: c.faint, fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: c.subtle }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                    <div className="mb-1 font-medium text-ink">{monthLabel(String(label))} {String(label).slice(0, 4)}</div>
                    {payload.map((p) => (
                      <div key={String(p.dataKey)} className="flex items-center justify-between gap-6 text-muted">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-sm" style={{ background: p.color }} />
                          {p.dataKey === 'income' ? 'Money in' : 'Money out'}
                        </span>
                        <span className="tabular font-medium text-ink">{money(Number(p.value), currency)}</span>
                      </div>
                    ))}
                  </div>
                ) : null
              }
            />
            <Bar dataKey="income" fill={c.in} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="expense" fill={c.out} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CategoryBreakdown({ rows, currency }: { rows: { category: ExpenseCategory; total: number }[]; currency: string }) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  const sum = rows.reduce((s, r) => s + r.total, 0);
  if (!rows.length) return <div className="py-8 text-center text-[13px] text-faint">No expenses yet</div>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.category} title={`${CATEGORY[r.category]}: ${money(r.total, currency)}`}>
          <div className="mb-1 flex items-baseline justify-between text-[13px]">
            <span className="text-muted">{CATEGORY[r.category] ?? r.category}</span>
            <span className="tabular font-medium">
              {money(r.total, currency)} <span className="font-normal text-faint">· {Math.round((r.total / sum) * 100)}%</span>
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-subtle">
            <div className="h-full rounded-full bg-[var(--ph-series-out)]" style={{ width: `${(r.total / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
