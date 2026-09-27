import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, FolderKanban, Plus, Receipt } from 'lucide-react';
import { api, type Dashboard as DashboardData } from '../lib/api';
import { CATEGORY, date, money, runway } from '../lib/format';
import { useAuth } from '../lib/auth';
import { useProjects } from '../lib/hooks';
import { Button, Card, CardHeader, ColorDot, EmptyState, PageHeader, Segmented, Spinner, Stat, Table, Td, Th } from '../components/ui';
import { CashflowChart } from '../components/Charts';
import { Balance, RenewalBadge, RunwayText, StatusBadge } from '../components/shared';
import { ExpenseFormModal, IncomeFormModal, ProjectFormModal } from '../components/forms';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardData>('/dashboard') });
  const ongoing = useProjects('ongoing');
  const [cur, setCur] = useState<string | null>(null);
  const [modal, setModal] = useState<'project' | 'income' | 'expense' | null>(null);

  const d = dash.data;
  const currencies = useMemo(
    () =>
      (d?.currencies ?? []).filter(
        (c) => c.income_received || c.project_expenses || c.overhead_expenses || c.monthly_payroll || c.monthly_subscriptions || c.pipeline_value || c.income_expected,
      ),
    [d],
  );
  const mostUsed = [...currencies].sort((a, b) => b.project_count - a.project_count)[0]?.currency;
  const currency = cur && currencies.some((c) => c.currency === cur) ? cur : mostUsed ?? 'USD';
  const t = currencies.find((c) => c.currency === currency);
  const monthly = (d?.monthly ?? []).filter((m) => m.currency === currency);
  const available = (t?.income_received ?? 0) - (t?.project_expenses ?? 0);
  const burn = (t?.monthly_payroll ?? 0) + (t?.monthly_subscriptions ?? 0);
  const rw = runway(available, burn);

  if (dash.isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${user?.name.split(' ')[0]}`}
        subtitle={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={
          <>
            <Button icon={<ArrowDownLeft className="size-4" />} onClick={() => setModal('income')}>
              Money in
            </Button>
            <Button icon={<ArrowUpRight className="size-4" />} onClick={() => setModal('expense')}>
              Money out
            </Button>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setModal('project')}>
              New project
            </Button>
          </>
        }
      />

      {currencies.length > 1 && (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-[13px] text-muted">Currency</span>
          <Segmented value={currency} onChange={setCur} items={currencies.map((c) => ({ value: c.currency, label: c.currency }))} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Available balance"
          value={money(available, currency)}
          tone={available < 0 ? 'neg' : undefined}
          sub="Received − spent, all projects"
        />
        <Stat
          label="Monthly burn"
          value={money(Math.round(burn), currency)}
          sub={rw === null ? 'Payroll + subscriptions' : `≈ ${rw >= 24 ? '24+' : rw.toFixed(1)} months runway`}
        />
        <Stat label="Expected income" value={money(t?.income_expected ?? 0, currency)} sub="Invoiced / not yet received" />
        <Stat
          label="Weighted pipeline"
          value={money(t?.pipeline_weighted ?? 0, currency)}
          sub={`${d?.counts.opportunities ?? 0} opportunities · ${money(t?.pipeline_value ?? 0, currency, { compact: true })} total`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Cash flow" subtitle={`Last 12 months · ${currency} · includes company overhead`} />
          <CashflowChart data={monthly} currency={currency} />
        </Card>
        <Card>
          <CardHeader
            title="Upcoming renewals"
            subtitle="Next 30 days"
            action={
              <Link to="/subscriptions" className="text-[13px] text-muted hover:text-ink">
                View all
              </Link>
            }
          />
          {d?.renewals.length ? (
            <div className="-mx-2 space-y-0.5">
              {d.renewals.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-subtle">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.name}</div>
                    <div className="truncate text-xs text-faint">{r.project_name ?? 'Company-wide'}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <div className="tabular font-medium text-ink">{money(r.amount, r.currency)}</div>
                    <RenewalBadge date={r.next_renewal} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-[13px] text-faint">Nothing due soon</div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card padded={false} className="lg:col-span-2">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="text-[15px] font-semibold tracking-tight">Ongoing projects</h3>
            <Link to="/projects" className="text-[13px] text-muted hover:text-ink">
              All projects
            </Link>
          </div>
          {ongoing.data?.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Project</Th>
                  <Th className="text-right">Balance</Th>
                  <Th className="hidden text-right sm:table-cell">Burn / month</Th>
                  <Th className="hidden md:table-cell">Runway</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {ongoing.data.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-subtle/60" onClick={() => nav(`/projects/${p.id}`)}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <ColorDot color={p.color} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.name}</div>
                          <div className="truncate text-xs text-faint">{p.client || '—'}</div>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-right font-medium">
                      <Balance value={p.balance} currency={p.currency} />
                    </Td>
                    <Td className="hidden text-right tabular text-muted sm:table-cell">{money(p.monthly_burn, p.currency)}</Td>
                    <Td className="hidden text-[13px] md:table-cell">
                      {p.status === 'on_hold' ? <StatusBadge status={p.status} /> : <RunwayText balance={p.balance} burn={p.monthly_burn} />}
                    </Td>
                    <Td className="w-8 text-faint">
                      <ChevronRight className="size-4" />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              icon={<FolderKanban className="size-5" />}
              title="No ongoing projects"
              text="Create a project or convert an opportunity to start tracking its money."
              action={<Button onClick={() => setModal('project')}>New project</Button>}
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            action={
              <Link to="/finance" className="text-[13px] text-muted hover:text-ink">
                Finance
              </Link>
            }
          />
          {d?.recent.length ? (
            <div className="space-y-3.5">
              {d.recent.map((r) => (
                <div key={`${r.type}-${r.id}`} className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${r.type === 'income' ? 'bg-pos-soft text-pos' : 'bg-subtle text-muted'}`}
                  >
                    {r.type === 'income' ? <ArrowDownLeft className="size-3.5" /> : <Receipt className="size-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{r.description}</div>
                    <div className="truncate text-xs text-faint">
                      {r.project_name ?? 'Company'} · {date(r.date)}
                      {r.type === 'expense' ? ` · ${CATEGORY[r.extra as keyof typeof CATEGORY] ?? r.extra}` : r.extra === 'expected' ? ' · expected' : ''}
                    </div>
                  </div>
                  <div className={`shrink-0 text-[13px] font-medium tabular ${r.type === 'income' ? (r.extra === 'expected' ? 'text-faint' : 'text-pos') : ''}`}>
                    {r.type === 'income' ? '+' : '−'}
                    {money(r.amount, r.currency)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-[13px] text-faint">No transactions yet</div>
          )}
        </Card>
      </div>

      <ProjectFormModal open={modal === 'project'} onClose={() => setModal(null)} onSaved={(p) => nav(`/projects/${p.id}`)} />
      <IncomeFormModal open={modal === 'income'} onClose={() => setModal(null)} />
      <ExpenseFormModal open={modal === 'expense'} onClose={() => setModal(null)} />
    </div>
  );
}
