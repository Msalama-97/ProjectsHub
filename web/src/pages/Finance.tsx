import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, FileDown, Search, Wallet } from 'lucide-react';
import { api, type Expense, type Income } from '../lib/api';
import { CATEGORY, date, downloadCsv, money, today } from '../lib/format';
import { useProjects, useSave } from '../lib/hooks';
import { Badge, Button, Card, ColorDot, ConfirmDialog, EmptyState, Input, PageHeader, Segmented, Select, Spinner, Table, Td, Th, cx, useConfirm } from '../components/ui';
import { RowActions } from '../components/shared';
import { ExpenseFormModal, IncomeFormModal } from '../components/forms';

type Row =
  | { kind: 'in'; id: string; date: string; description: string; amount: number; currency: string; project_id: number | null; project_name: string | null; project_color: string | null; label: string; tone: 'pos' | 'warn'; src: Income }
  | { kind: 'out'; id: string; date: string; description: string; amount: number; currency: string; project_id: number | null; project_name: string | null; project_color: string | null; label: string; tone: 'neutral'; src: Expense };

type Period = 'month' | 'quarter' | 'year' | 'all';

function periodStart(p: Period) {
  const d = new Date();
  if (p === 'month') return today().slice(0, 8) + '01';
  if (p === 'quarter') {
    d.setMonth(d.getMonth() - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
  if (p === 'year') return `${d.getFullYear()}-01-01`;
  return '';
}

export default function Finance() {
  const incomes = useQuery({ queryKey: ['incomes', 'all'], queryFn: () => api.get<Income[]>('/incomes') });
  const expenses = useQuery({ queryKey: ['expenses', 'all'], queryFn: () => api.get<Expense[]>('/expenses') });
  const projects = useProjects();
  const [type, setType] = useState<'all' | 'in' | 'out'>('all');
  const [project, setProject] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [incomeModal, setIncomeModal] = useState<Income | 'new' | null>(null);
  const [expenseModal, setExpenseModal] = useState<Expense | 'new' | null>(null);
  const confirm = useConfirm<Row>();
  const rm = useSave(
    (r: Row) => api.del(r.kind === 'in' ? `/incomes/${r.src.id}` : `/expenses/${r.src.id}`),
    'Deleted',
    confirm.close,
  );

  const rows = useMemo<Row[]>(() => {
    const a: Row[] = (incomes.data ?? []).map((i) => ({
      kind: 'in',
      id: `i${i.id}`,
      date: i.date,
      description: i.description,
      amount: i.amount,
      currency: i.currency ?? 'USD',
      project_id: i.project_id,
      project_name: i.project_name ?? null,
      project_color: i.project_color ?? null,
      label: i.status === 'received' ? 'Received' : 'Expected',
      tone: i.status === 'received' ? 'pos' : 'warn',
      src: i,
    }));
    const b: Row[] = (expenses.data ?? []).map((e) => ({
      kind: 'out',
      id: `e${e.id}`,
      date: e.date,
      description: e.description,
      amount: e.amount,
      currency: e.currency,
      project_id: e.project_id,
      project_name: e.project_name ?? null,
      project_color: e.project_color ?? null,
      label: CATEGORY[e.category],
      tone: 'neutral',
      src: e,
    }));
    return [...a, ...b].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  }, [incomes.data, expenses.data]);

  const start = periodStart(period);
  const filtered = rows.filter(
    (r) =>
      (type === 'all' || r.kind === type) &&
      (!project || (project === 'company' ? r.project_id === null : r.project_id === Number(project))) &&
      (!start || r.date >= start) &&
      (!category || (r.kind === 'out' && r.src.category === category)) &&
      (!q || `${r.description} ${r.project_name ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  );

  const totals = filtered.reduce<Record<string, { in: number; out: number; expected: number }>>((acc, r) => {
    const t = (acc[r.currency] ??= { in: 0, out: 0, expected: 0 });
    if (r.kind === 'in') {
      if (r.src.status === 'received') t.in += r.amount;
      else t.expected += r.amount;
    } else t.out += r.amount;
    return acc;
  }, {});

  const exportCsv = () =>
    downloadCsv(`projecthub-transactions-${today()}.csv`, [
      ['Date', 'Type', 'Project', 'Description', 'Category / Status', 'Amount', 'Currency'],
      ...filtered.map((r) => [r.date, r.kind === 'in' ? 'Income' : 'Expense', r.project_name ?? 'Company', r.description, r.label, r.kind === 'in' ? r.amount : -r.amount, r.currency]),
    ]);

  const loading = incomes.isLoading || expenses.isLoading;

  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle="Every payment in and out, across all projects and company overhead."
        actions={
          <>
            <Button icon={<FileDown className="size-4" />} onClick={exportCsv} disabled={!filtered.length}>
              Export CSV
            </Button>
            <Button icon={<ArrowDownLeft className="size-4" />} onClick={() => setIncomeModal('new')}>
              Money in
            </Button>
            <Button variant="primary" icon={<ArrowUpRight className="size-4" />} onClick={() => setExpenseModal('new')}>
              Money out
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.keys(totals).length === 0 && (
          <Card className="text-sm text-muted sm:col-span-2 lg:col-span-3">No transactions match these filters.</Card>
        )}
        {Object.entries(totals).map(([c, t]) => (
          <Card key={c}>
            <div className="flex items-center justify-between text-[13px] font-medium text-muted">
              <span>Net · {c}</span>
              <Wallet className="size-4 text-faint" />
            </div>
            <div className={cx('mt-2 text-2xl font-semibold tracking-tight tabular', t.in - t.out < 0 && 'text-neg')}>{money(t.in - t.out, c, { sign: true })}</div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="text-pos">In {money(t.in, c)}</span>
              <span className="text-muted">Out {money(t.out, c)}</span>
              {t.expected > 0 && <span className="text-warn">Expected {money(t.expected, c)}</span>}
            </div>
          </Card>
        ))}
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 px-5 pt-5 pb-3">
          <Segmented
            value={type}
            onChange={setType}
            items={[
              { value: 'all', label: 'All' },
              { value: 'in', label: 'Money in' },
              { value: 'out', label: 'Money out' },
            ]}
          />
          <Select wrapClassName="w-full sm:w-52" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">All projects & company</option>
            <option value="company">Company overhead only</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select wrapClassName="w-full sm:w-40" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="all">All time</option>
            <option value="month">This month</option>
            <option value="quarter">Last 3 months</option>
            <option value="year">This year</option>
          </Select>
          {type !== 'in' && (
            <Select wrapClassName="w-full sm:w-44" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {Object.entries(CATEGORY).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          )}
          <div className="relative ml-auto w-full sm:w-56">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <Input className="pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {loading ? (
          <Spinner />
        ) : filtered.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Description</Th>
                <Th className="hidden md:table-cell">Project</Th>
                <Th>Type</Th>
                <Th className="text-right">Amount</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="group hover:bg-subtle/60">
                  <Td className="whitespace-nowrap text-muted">{date(r.date)}</Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className={cx('flex size-6 shrink-0 items-center justify-center rounded-md', r.kind === 'in' ? 'bg-pos-soft text-pos' : 'bg-subtle text-muted')}>
                        {r.kind === 'in' ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                      </span>
                      <span className="font-medium">{r.description}</span>
                    </div>
                  </Td>
                  <Td className="hidden md:table-cell">
                    {r.project_id ? (
                      <Link to={`/projects/${r.project_id}?tab=finance`} className="inline-flex items-center gap-1.5 text-[13px] hover:underline">
                        <ColorDot color={r.project_color} className="size-2" /> {r.project_name}
                      </Link>
                    ) : (
                      <span className="text-[13px] text-faint">Company overhead</span>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={r.tone}>{r.label}</Badge>
                  </Td>
                  <Td className={cx('text-right font-medium whitespace-nowrap tabular', r.kind === 'in' ? (r.tone === 'pos' ? 'text-pos' : 'text-muted') : '')}>
                    {r.kind === 'in' ? '+' : '−'}
                    {money(r.amount, r.currency)}
                  </Td>
                  <Td className="w-20">
                    <RowActions
                      onEdit={() => (r.kind === 'in' ? setIncomeModal(r.src) : setExpenseModal(r.src))}
                      onDelete={() => confirm.ask(r)}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<Wallet className="size-5" />} title="Nothing here" text="Record client payments and expenses — or change the filters above." />
        )}
      </Card>

      <IncomeFormModal open={!!incomeModal} onClose={() => setIncomeModal(null)} income={incomeModal === 'new' ? undefined : incomeModal ?? undefined} />
      <ExpenseFormModal open={!!expenseModal} onClose={() => setExpenseModal(null)} expense={expenseModal === 'new' ? undefined : expenseModal ?? undefined} />
      <ConfirmDialog
        open={!!confirm.target}
        onClose={confirm.close}
        onConfirm={() => rm.mutate(confirm.target!)}
        loading={rm.isPending}
        title={confirm.target?.kind === 'in' ? 'Delete payment?' : 'Delete expense?'}
        text={`“${confirm.target?.description}” (${money(confirm.target?.amount, confirm.target?.currency)}) will be removed.`}
      />
    </div>
  );
}
