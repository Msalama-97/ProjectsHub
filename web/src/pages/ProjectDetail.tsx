import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Pencil,
  Plus,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import { api, type Allocation, type Doc, type Expense, type ExpenseCategory, type Income, type Note, type Project, type Subscription } from '../lib/api';
import { CATEGORY, CYCLE, STATUS, date, fileSize, money } from '../lib/format';
import { useSave } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  ProgressBar,
  Select,
  Spinner,
  Stat,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  useConfirm,
  cx,
} from '../components/ui';
import { CashflowChart, CategoryBreakdown } from '../components/Charts';
import { RenewalBadge, RowActions, RunwayText, StatusBadge } from '../components/shared';
import {
  AllocationFormModal,
  DocumentFormModal,
  ExpenseFormModal,
  IncomeFormModal,
  PayrollModal,
  PaySubscriptionModal,
  ProjectFormModal,
  SubscriptionFormModal,
} from '../components/forms';

type Tab = 'overview' | 'finance' | 'team' | 'subscriptions' | 'documents' | 'notes';

export default function ProjectDetail() {
  const id = Number(useParams().id);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'overview';
  const nav = useNavigate();
  const project = useQuery({ queryKey: ['project', id], queryFn: () => api.get<Project>(`/projects/${id}`) });
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const del = useSave(() => api.del(`/projects/${id}`), 'Project deleted', () => nav('/projects'));
  const setStatus = useSave((status: string) => api.patch(`/projects/${id}`, { status }), 'Status updated');

  if (project.isLoading) return <Spinner />;
  if (!project.data)
    return (
      <EmptyState
        title="Project not found"
        action={
          <Link to="/projects">
            <Button>Back to projects</Button>
          </Link>
        }
      />
    );
  const p = project.data;
  const isOpp = p.status === 'opportunity';
  const collected = p.contract_value ? (p.income_received / p.contract_value) * 100 : null;

  return (
    <div>
      <PageHeader
        back={
          <Link to={isOpp ? '/projects?tab=opportunities' : ['completed', 'lost', 'cancelled'].includes(p.status) ? '/projects?tab=past' : '/projects'} className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
            <ArrowLeft className="size-3.5" /> Projects
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <span className="size-3 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p.status} />
            {p.client && <span>{p.client}</span>}
            {p.code && <span className="text-faint">· {p.code}</span>}
            {p.jira_url && (
              <a href={p.jira_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                · Jira <ExternalLink className="size-3" />
              </a>
            )}
          </span>
        }
        actions={
          <>
            {isOpp && (
              <Button variant="primary" icon={<Trophy className="size-4" />} onClick={() => setStatus.mutate('active')} loading={setStatus.isPending}>
                Mark as won
              </Button>
            )}
            <Select wrapClassName="w-40" value={p.status} onChange={(e) => setStatus.mutate(e.target.value)} aria-label="Status">
              {Object.entries(STATUS).map(([k, s]) => (
                <option key={k} value={k}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Button icon={<Pencil className="size-3.5" />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(true)} title="Delete project" className="!px-2.5 hover:!text-neg">
              <Trash2 className="size-4" />
            </Button>
          </>
        }
      />

      {isOpp ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Estimated value" value={p.contract_value ? money(p.contract_value, p.currency) : '—'} />
          <Stat label="Win chance" value={`${p.probability ?? '—'}%`} />
          <Stat label="Weighted value" value={money(((p.contract_value ?? 0) * (p.probability ?? 50)) / 100, p.currency)} />
          <Stat label="Expected start" value={<span className="text-xl">{date(p.start_date)}</span>} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Available balance" value={money(p.balance, p.currency)} tone={p.balance < 0 ? 'neg' : undefined} sub="Received − spent" />
          <Stat
            label="Received"
            value={money(p.income_received, p.currency)}
            sub={
              collected !== null
                ? `${Math.round(collected)}% of ${money(p.contract_value, p.currency)}`
                : p.income_expected
                  ? `+ ${money(p.income_expected, p.currency)} expected`
                  : 'No contract value set'
            }
          />
          <Stat label="Spent" value={money(p.expenses_total, p.currency)} sub={p.income_expected ? `${money(p.income_expected, p.currency)} still expected in` : undefined} />
          <Stat label="Monthly burn" value={money(p.monthly_burn, p.currency)} sub={<RunwayText balance={p.balance} burn={p.monthly_burn} />} />
        </div>
      )}

      <Tabs
        className="mt-6"
        value={tab}
        onChange={(t) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'finance', label: 'Finance' },
          { value: 'team', label: 'Team', count: p.team_count },
          { value: 'subscriptions', label: 'Subscriptions' },
          { value: 'documents', label: 'Documents', count: p.document_count },
          { value: 'notes', label: 'Notes' },
        ]}
      />
      <div className="mt-5">
        {tab === 'overview' && <Overview p={p} collected={collected} />}
        {tab === 'finance' && <Finance p={p} />}
        {tab === 'team' && <Team p={p} />}
        {tab === 'subscriptions' && <Subs p={p} />}
        {tab === 'documents' && <Docs p={p} />}
        {tab === 'notes' && <Notes p={p} />}
      </div>

      <ProjectFormModal open={editing} onClose={() => setEditing(false)} project={p} />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => del.mutate(undefined)}
        loading={del.isPending}
        title="Delete this project?"
        text={
          <>
            This permanently deletes <b className="text-ink">{p.name}</b> with all its payments, expenses, team allocations, subscriptions, documents and notes.
            If the project is just finished, set its status to <b className="text-ink">Completed</b> instead.
          </>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------- Overview
function Overview({ p, collected }: { p: Project; collected: number | null }) {
  const monthly = useQuery({ queryKey: ['project-monthly', p.id], queryFn: () => api.get<{ month: string; income: number; expense: number }[]>(`/projects/${p.id}/monthly`) });
  const breakdown = useQuery({ queryKey: ['project-breakdown', p.id], queryFn: () => api.get<{ category: ExpenseCategory; total: number }[]>(`/projects/${p.id}/breakdown`) });
  const details: [string, React.ReactNode][] = [
    ['Client', p.client || '—'],
    ['Code', p.code || '—'],
    ['Owner', p.owner_name || '—'],
    ['Currency', p.currency],
    [p.status === 'opportunity' ? 'Estimated value' : 'Contract value', p.contract_value ? money(p.contract_value, p.currency) : '—'],
    ['Start', date(p.start_date)],
    ['End', p.end_date ? date(p.end_date) : 'Ongoing'],
    ['Created', date(p.created_at)],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader title="Description" />
          {p.description ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink/90">{p.description}</p>
          ) : (
            <p className="text-sm text-faint">No description yet. Click Edit to add scope, goals and key contacts.</p>
          )}
        </Card>
        {p.status !== 'opportunity' && (
          <Card>
            <CardHeader title="Cash flow" subtitle={`Last 12 months · ${p.currency}`} />
            <CashflowChart data={monthly.data ?? []} currency={p.currency} height={220} />
          </Card>
        )}
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Details" />
          <dl className="space-y-2.5 text-sm">
            {details.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium tabular">{v}</dd>
              </div>
            ))}
          </dl>
          {collected !== null && p.status !== 'opportunity' && (
            <div className="mt-5 border-t border-line pt-4">
              <div className="mb-1.5 flex justify-between text-xs text-muted">
                <span>Collected from client</span>
                <span className="tabular">{Math.round(collected)}%</span>
              </div>
              <ProgressBar value={collected} tone="pos" />
            </div>
          )}
        </Card>
        {p.status !== 'opportunity' && (
          <Card>
            <CardHeader title="Where the money went" />
            <CategoryBreakdown rows={breakdown.data ?? []} currency={p.currency} />
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Finance
function Finance({ p }: { p: Project }) {
  const incomes = useQuery({ queryKey: ['incomes', p.id], queryFn: () => api.get<Income[]>(`/incomes?project_id=${p.id}`) });
  const expenses = useQuery({ queryKey: ['expenses', p.id], queryFn: () => api.get<Expense[]>(`/expenses?project_id=${p.id}`) });
  const allocations = useQuery({ queryKey: ['allocations', p.id], queryFn: () => api.get<Allocation[]>(`/allocations?project_id=${p.id}`) });
  const [incomeModal, setIncomeModal] = useState<Income | 'new' | null>(null);
  const [expenseModal, setExpenseModal] = useState<Expense | 'new' | null>(null);
  const [payroll, setPayroll] = useState(false);
  const [cat, setCat] = useState('');
  const delIncome = useConfirm<Income>();
  const delExpense = useConfirm<Expense>();
  const rmIncome = useSave((id: number) => api.del(`/incomes/${id}`), 'Payment deleted', delIncome.close);
  const rmExpense = useSave((id: number) => api.del(`/expenses/${id}`), 'Expense deleted', delExpense.close);
  const markReceived = useSave((i: Income) => api.patch(`/incomes/${i.id}`, { status: 'received' }), 'Marked as received');

  const exp = (expenses.data ?? []).filter((e) => !cat || e.category === cat);

  return (
    <div className="space-y-4">
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight">Money in</h3>
            <p className="text-[13px] text-muted">
              {money(p.income_received, p.currency)} received{p.income_expected ? ` · ${money(p.income_expected, p.currency)} expected` : ''}
            </p>
          </div>
          <Button icon={<ArrowDownLeft className="size-4" />} onClick={() => setIncomeModal('new')}>
            Record payment
          </Button>
        </div>
        {incomes.data?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Description</Th>
                <Th className="hidden md:table-cell">Reference</Th>
                <Th>Status</Th>
                <Th className="text-right">Amount</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {incomes.data.map((i) => (
                <tr key={i.id} className="group hover:bg-subtle/60">
                  <Td className="whitespace-nowrap text-muted">{date(i.date)}</Td>
                  <Td className="font-medium">{i.description}</Td>
                  <Td className="hidden text-muted md:table-cell">{i.reference || '—'}</Td>
                  <Td>{i.status === 'received' ? <Badge tone="pos">Received</Badge> : <Badge tone="warn">Expected</Badge>}</Td>
                  <Td className={cx('text-right font-medium tabular', i.status === 'received' ? 'text-pos' : 'text-muted')}>{money(i.amount, p.currency)}</Td>
                  <Td className="w-28">
                    <RowActions onEdit={() => setIncomeModal(i)} onDelete={() => delIncome.ask(i)}>
                      {i.status === 'expected' && (
                        <Button size="sm" variant="ghost" onClick={() => markReceived.mutate(i)}>
                          Received
                        </Button>
                      )}
                    </RowActions>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No payments yet" text="Record client payments here — deposits, milestones, retainers." />
        )}
      </Card>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight">Money out</h3>
            <p className="text-[13px] text-muted">{money(p.expenses_total, p.currency)} spent in total</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select wrapClassName="w-44" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">All categories</option>
              {Object.entries(CATEGORY).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
            <Button icon={<Users className="size-4" />} onClick={() => setPayroll(true)}>
              Record payroll
            </Button>
            <Button icon={<ArrowUpRight className="size-4" />} onClick={() => setExpenseModal('new')}>
              Add expense
            </Button>
          </div>
        </div>
        {exp.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Description</Th>
                <Th>Category</Th>
                <Th className="text-right">Amount</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {exp.map((e) => (
                <tr key={e.id} className="group hover:bg-subtle/60">
                  <Td className="whitespace-nowrap text-muted">{date(e.date)}</Td>
                  <Td>
                    <div className="font-medium">{e.description}</div>
                    {((e.person_name && !e.description.includes(e.person_name)) || e.notes) && (
                      <div className="text-xs text-faint">{[e.person_name && !e.description.includes(e.person_name) ? e.person_name : null, e.notes].filter(Boolean).join(' · ')}</div>
                    )}
                  </Td>
                  <Td>
                    <Badge>{CATEGORY[e.category]}</Badge>
                  </Td>
                  <Td className="text-right font-medium tabular">{money(e.amount, p.currency)}</Td>
                  <Td className="w-20">
                    <RowActions onEdit={() => setExpenseModal(e)} onDelete={() => delExpense.ask(e)} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title={cat ? 'No expenses in this category' : 'No expenses yet'} text="Salaries, subscriptions, contractors and any other costs for this project." />
        )}
      </Card>

      <IncomeFormModal open={!!incomeModal} onClose={() => setIncomeModal(null)} projectId={p.id} income={incomeModal === 'new' ? undefined : incomeModal ?? undefined} />
      <ExpenseFormModal open={!!expenseModal} onClose={() => setExpenseModal(null)} projectId={p.id} expense={expenseModal === 'new' ? undefined : expenseModal ?? undefined} />
      <PayrollModal open={payroll} onClose={() => setPayroll(false)} project={p} allocations={allocations.data ?? []} />
      <ConfirmDialog
        open={!!delIncome.target}
        onClose={delIncome.close}
        onConfirm={() => rmIncome.mutate(delIncome.target!.id)}
        loading={rmIncome.isPending}
        title="Delete payment?"
        text={`“${delIncome.target?.description}” (${money(delIncome.target?.amount, p.currency)}) will be removed.`}
      />
      <ConfirmDialog
        open={!!delExpense.target}
        onClose={delExpense.close}
        onConfirm={() => rmExpense.mutate(delExpense.target!.id)}
        loading={rmExpense.isPending}
        title="Delete expense?"
        text={`“${delExpense.target?.description}” (${money(delExpense.target?.amount, p.currency)}) will be removed.`}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Team
function Team({ p }: { p: Project }) {
  const allocations = useQuery({ queryKey: ['allocations', p.id], queryFn: () => api.get<Allocation[]>(`/allocations?project_id=${p.id}`) });
  const [modal, setModal] = useState<Allocation | 'new' | null>(null);
  const [payroll, setPayroll] = useState(false);
  const confirm = useConfirm<Allocation>();
  const rm = useSave((id: number) => api.del(`/allocations/${id}`), 'Removed from project', confirm.close);
  const current = (allocations.data ?? []).filter((a) => a.is_current);
  const monthly = current.reduce((s, a) => s + a.monthly_cost, 0);

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">Assigned people</h3>
          <p className="text-[13px] text-muted">
            {current.length} active · {money(monthly, p.currency)} per month
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setPayroll(true)} disabled={!current.length}>
            Record payroll
          </Button>
          <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setModal('new')}>
            Assign person
          </Button>
        </div>
      </div>
      {allocations.data?.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Person</Th>
              <Th>Role</Th>
              <Th>Allocation</Th>
              <Th className="hidden md:table-cell">Period</Th>
              <Th className="text-right">Cost / month</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {allocations.data.map((a) => (
              <tr key={a.id} className={cx('group hover:bg-subtle/60', !a.is_current && 'opacity-55')}>
                <Td>
                  <div className="font-medium">{a.person_name}</div>
                  <div className="text-xs text-faint">{a.person_title || '—'}</div>
                </Td>
                <Td className="text-muted">{a.role || '—'}</Td>
                <Td>
                  <div className="flex w-28 items-center gap-2">
                    <ProgressBar value={a.percent} />
                    <span className="w-9 text-right text-xs tabular text-muted">{a.percent}%</span>
                  </div>
                </Td>
                <Td className="hidden text-[13px] text-muted md:table-cell">
                  {a.start_date ? date(a.start_date) : 'Start'} → {a.end_date ? date(a.end_date) : 'ongoing'}
                  {!a.is_current && <Badge className="ml-2">Inactive</Badge>}
                </Td>
                <Td className="text-right font-medium tabular">{money(a.monthly_cost, p.currency)}</Td>
                <Td className="w-20">
                  <RowActions onEdit={() => setModal(a)} onDelete={() => confirm.ask(a)} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState
          icon={<Users className="size-5" />}
          title="No one assigned yet"
          text="Assign team members with their share of time and monthly cost. Add people first on the Team page."
        />
      )}
      <AllocationFormModal open={!!modal} onClose={() => setModal(null)} project={p} allocation={modal === 'new' ? undefined : modal ?? undefined} />
      <PayrollModal open={payroll} onClose={() => setPayroll(false)} project={p} allocations={allocations.data ?? []} />
      <ConfirmDialog
        open={!!confirm.target}
        onClose={confirm.close}
        onConfirm={() => rm.mutate(confirm.target!.id)}
        loading={rm.isPending}
        title="Remove from project?"
        confirmLabel="Remove"
        text={`${confirm.target?.person_name} will be removed from this project. Salary expenses already recorded are kept. To keep history, set an end date instead.`}
      />
    </Card>
  );
}

// ---------------------------------------------------------------- Subscriptions
function Subs({ p }: { p: Project }) {
  const subs = useQuery({ queryKey: ['subscriptions', p.id], queryFn: () => api.get<Subscription[]>(`/subscriptions?project_id=${p.id}`) });
  const [modal, setModal] = useState<Subscription | 'new' | null>(null);
  const [paying, setPaying] = useState<Subscription | null>(null);
  const confirm = useConfirm<Subscription>();
  const rm = useSave((id: number) => api.del(`/subscriptions/${id}`), 'Subscription deleted', confirm.close);
  const monthly = (subs.data ?? []).filter((s) => s.active).reduce((a, s) => a + s.monthly_equivalent, 0);

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">Project subscriptions</h3>
          <p className="text-[13px] text-muted">≈ {money(monthly, p.currency)} per month</p>
        </div>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setModal('new')}>
          Add subscription
        </Button>
      </div>
      {subs.data?.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Service</Th>
              <Th>Billing</Th>
              <Th className="text-right">Amount</Th>
              <Th className="hidden md:table-cell">Next renewal</Th>
              <Th className="hidden text-right lg:table-cell">Paid so far</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {subs.data.map((s) => (
              <tr key={s.id} className={cx('group hover:bg-subtle/60', !s.active && 'opacity-55')}>
                <Td>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-faint">{s.vendor || '—'}</div>
                </Td>
                <Td className="text-muted">{CYCLE[s.billing_cycle]}</Td>
                <Td className="text-right font-medium tabular">{money(s.amount, s.currency)}</Td>
                <Td className="hidden text-[13px] md:table-cell">{s.active ? <RenewalBadge date={s.next_renewal} /> : <Badge>Inactive</Badge>}</Td>
                <Td className="hidden text-right tabular text-muted lg:table-cell">{money(s.total_paid, s.currency)}</Td>
                <Td className="w-40">
                  <RowActions onEdit={() => setModal(s)} onDelete={() => confirm.ask(s)}>
                    {s.active && (
                      <Button size="sm" variant="ghost" icon={<CreditCard className="size-3.5" />} onClick={() => setPaying(s)}>
                        Pay
                      </Button>
                    )}
                  </RowActions>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={<CalendarClock className="size-5" />} title="No subscriptions" text="Hosting, SaaS tools, licenses and other recurring costs specific to this project." />
      )}
      <SubscriptionFormModal open={!!modal} onClose={() => setModal(null)} projectId={p.id} sub={modal === 'new' ? undefined : modal ?? undefined} />
      <PaySubscriptionModal open={!!paying} onClose={() => setPaying(null)} sub={paying!} />
      <ConfirmDialog
        open={!!confirm.target}
        onClose={confirm.close}
        onConfirm={() => rm.mutate(confirm.target!.id)}
        loading={rm.isPending}
        title="Delete subscription?"
        text="Past payments stay recorded as expenses. To just stop tracking renewals, edit it and switch it to inactive."
      />
    </Card>
  );
}

// ---------------------------------------------------------------- Documents
function Docs({ p }: { p: Project }) {
  const docs = useQuery({ queryKey: ['documents', p.id], queryFn: () => api.get<Doc[]>(`/documents?project_id=${p.id}`) });
  const [adding, setAdding] = useState(false);
  const confirm = useConfirm<Doc>();
  const rm = useSave((id: number) => api.del(`/documents/${id}`), 'Document deleted', confirm.close);

  return (
    <Card padded={false}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-[15px] font-semibold tracking-tight">Documents & links</h3>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
          Add document
        </Button>
      </div>
      {docs.data?.length ? (
        <div className="divide-y divide-line border-t border-line">
          {docs.data.map((d) => {
            const href = d.kind === 'file' ? `/api/documents/${d.id}/download?inline=1` : d.url!;
            return (
              <div key={d.id} className="group flex items-center gap-4 px-5 py-3 hover:bg-subtle/60">
                <div className={cx('flex size-9 shrink-0 items-center justify-center rounded-lg', d.kind === 'file' ? 'bg-accent-soft text-accent' : 'bg-subtle text-muted')}>
                  {d.kind === 'file' ? <FileText className="size-4" /> : <Link2 className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <a href={href} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:underline">
                    {d.title}
                  </a>
                  <div className="truncate text-xs text-faint">
                    <span className="capitalize">{d.category}</span>
                    {d.kind === 'file' ? ` · ${d.file_name} · ${fileSize(d.size_bytes)}` : ` · ${d.url}`} · {d.uploaded_by_name ?? '—'}, {date(d.created_at)}
                  </div>
                </div>
                <RowActions onDelete={() => confirm.ask(d)}>
                  {d.kind === 'file' ? (
                    <a href={`/api/documents/${d.id}/download`} title="Download" className="inline-flex size-8 items-center justify-center rounded-lg text-faint hover:bg-subtle hover:text-ink">
                      <Download className="size-3.5" />
                    </a>
                  ) : (
                    <a href={d.url!} target="_blank" rel="noreferrer" title="Open" className="inline-flex size-8 items-center justify-center rounded-lg text-faint hover:bg-subtle hover:text-ink">
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </RowActions>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<FileText className="size-5" />} title="No documents yet" text="Upload contracts, proposals and invoices, or link to files in Drive, Confluence or Notion." />
      )}
      <DocumentFormModal open={adding} onClose={() => setAdding(false)} projectId={p.id} />
      <ConfirmDialog
        open={!!confirm.target}
        onClose={confirm.close}
        onConfirm={() => rm.mutate(confirm.target!.id)}
        loading={rm.isPending}
        title="Delete document?"
        text={confirm.target?.kind === 'file' ? 'The uploaded file will be permanently deleted from the server.' : 'The link will be removed.'}
      />
    </Card>
  );
}

// ---------------------------------------------------------------- Notes
function Notes({ p }: { p: Project }) {
  const { user } = useAuth();
  const notes = useQuery({ queryKey: ['notes', p.id], queryFn: () => api.get<Note[]>(`/projects/${p.id}/notes`) });
  const [body, setBody] = useState('');
  const add = useSave(() => api.post(`/projects/${p.id}/notes`, { body }), undefined, () => setBody(''));
  const rm = useSave((id: number) => api.del(`/projects/${p.id}/notes/${id}`));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Notes & decisions" subtitle="Meeting notes, agreements, reminders — a simple log for the team." />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) add.mutate(undefined);
          }}
        >
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a note…" rows={3} className="min-h-0" />
          <div className="mt-2 flex justify-end">
            <Button type="submit" variant="primary" size="sm" loading={add.isPending} disabled={!body.trim()}>
              Add note
            </Button>
          </div>
        </form>
        <div className="mt-6 space-y-5">
          {notes.data?.map((n) => (
            <div key={n.id} className="group flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-muted">
                {(n.author_name ?? '?')
                  .split(' ')
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-faint">
                  <span className="font-medium text-ink">{n.author_name ?? 'Unknown'}</span>
                  {new Date(n.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  {(n.author_id === user?.id || user?.role === 'admin') && (
                    <button onClick={() => rm.mutate(n.id)} className="ml-auto opacity-0 transition group-hover:opacity-100 hover:text-neg">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{n.body}</p>
              </div>
            </div>
          ))}
          {notes.data?.length === 0 && <p className="text-center text-[13px] text-faint">No notes yet.</p>}
        </div>
      </Card>
    </div>
  );
}
