import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus, Users } from 'lucide-react';
import { api, type Person } from '../lib/api';
import { EMPLOYMENT, money } from '../lib/format';
import { usePeople, useSave } from '../lib/hooks';
import { Badge, Button, Card, ColorDot, ConfirmDialog, EmptyState, Input, PageHeader, ProgressBar, Segmented, Spinner, Stat, Table, Td, Th, cx, useConfirm } from '../components/ui';
import { RowActions } from '../components/shared';
import { PersonFormModal } from '../components/forms';

export default function Team() {
  const people = usePeople();
  const [modal, setModal] = useState<Person | 'new' | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const confirm = useConfirm<Person>();
  const rm = useSave((id: number) => api.del(`/people/${id}`), 'Person deleted', confirm.close);

  const list = (people.data ?? [])
    .filter((p) => filter === 'all' || p.active)
    .filter((p) => !q || `${p.name} ${p.title ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  const active = (people.data ?? []).filter((p) => p.active);
  const payrollByCur = active.reduce<Record<string, number>>((acc, p) => ((acc[p.currency] = (acc[p.currency] ?? 0) + p.monthly_salary), acc), {});
  const over = active.filter((p) => p.allocated_percent > 100).length;
  const free = active.filter((p) => p.allocated_percent < 100).length;

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="People, salaries and who is working on what."
        actions={
          <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setModal('new')}>
            Add person
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active people" value={active.length} />
        <Stat
          label="Monthly salaries"
          value={
            Object.keys(payrollByCur).length ? (
              <span className="flex flex-col">
                {Object.entries(payrollByCur).map(([c, v]) => (
                  <span key={c}>{money(v, c)}</span>
                ))}
              </span>
            ) : (
              '—'
            )
          }
        />
        <Stat label="With free capacity" value={free} sub="Allocated under 100%" />
        <Stat label="Over-allocated" value={over} tone={over ? 'neg' : undefined} sub="Allocated over 100%" />
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <Input className="pl-9" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Segmented
            value={filter}
            onChange={setFilter}
            items={[
              { value: 'active', label: 'Active' },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>
        {people.isLoading ? (
          <Spinner />
        ) : list.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th className="hidden md:table-cell">Type</Th>
                <Th className="text-right">Salary / month</Th>
                <Th>Allocation</Th>
                <Th className="hidden lg:table-cell">Projects</Th>
                <Th className="hidden text-right xl:table-cell">Paid to date</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={cx('group hover:bg-subtle/60', !p.active && 'opacity-55')}>
                  <Td>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-faint">{p.title || p.email || '—'}</div>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <Badge>{EMPLOYMENT[p.employment_type]}</Badge>
                  </Td>
                  <Td className="text-right font-medium tabular">{money(p.monthly_salary, p.currency)}</Td>
                  <Td>
                    <div className="flex w-32 items-center gap-2">
                      <ProgressBar value={p.allocated_percent} tone={p.allocated_percent > 100 ? 'neg' : p.allocated_percent === 100 ? 'pos' : 'accent'} />
                      <span className={cx('w-10 text-right text-xs tabular', p.allocated_percent > 100 ? 'text-neg' : 'text-muted')}>{p.allocated_percent}%</span>
                    </div>
                  </Td>
                  <Td className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1.5">
                      {p.allocations.length ? (
                        p.allocations.map((a) => (
                          <Link
                            key={a.id}
                            to={`/projects/${a.project_id}?tab=team`}
                            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-xs hover:bg-subtle"
                          >
                            <ColorDot color={a.project_color} className="size-2" />
                            {a.project_name}
                            <span className="text-faint">{a.percent}%</span>
                          </Link>
                        ))
                      ) : (
                        <span className="text-xs text-faint">Not assigned</span>
                      )}
                    </div>
                  </Td>
                  <Td className="hidden text-right tabular text-muted xl:table-cell">{money(p.total_paid, p.currency)}</Td>
                  <Td className="w-20">
                    <RowActions onEdit={() => setModal(p)} onDelete={() => confirm.ask(p)} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            icon={<Users className="size-5" />}
            title={q ? 'No matches' : 'No team members yet'}
            text="Add the people who work on your projects — employees, contractors and freelancers — with their monthly cost."
          />
        )}
      </Card>

      <PersonFormModal open={!!modal} onClose={() => setModal(null)} person={modal === 'new' ? undefined : modal ?? undefined} />
      <ConfirmDialog
        open={!!confirm.target}
        onClose={confirm.close}
        onConfirm={() => rm.mutate(confirm.target!.id)}
        loading={rm.isPending}
        title="Delete team member?"
        text={`${confirm.target?.name} and their project allocations will be removed. Recorded salary expenses stay. If they left, mark them inactive instead to keep history.`}
      />
    </div>
  );
}
