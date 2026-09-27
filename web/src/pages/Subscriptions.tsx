import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CreditCard, Plus } from 'lucide-react';
import { api, type Subscription } from '../lib/api';
import { CYCLE, date, money } from '../lib/format';
import { useSave } from '../lib/hooks';
import { Badge, Button, Card, ColorDot, ConfirmDialog, EmptyState, PageHeader, Segmented, Spinner, Stat, Table, Td, Th, cx, useConfirm } from '../components/ui';
import { RenewalBadge, RowActions } from '../components/shared';
import { PaySubscriptionModal, SubscriptionFormModal } from '../components/forms';

export default function Subscriptions() {
  const subs = useQuery({ queryKey: ['subscriptions', 'all'], queryFn: () => api.get<Subscription[]>('/subscriptions') });
  const [scope, setScope] = useState<'all' | 'company' | 'projects'>('all');
  const [modal, setModal] = useState<Subscription | 'new' | null>(null);
  const [paying, setPaying] = useState<Subscription | null>(null);
  const confirm = useConfirm<Subscription>();
  const rm = useSave((id: number) => api.del(`/subscriptions/${id}`), 'Subscription deleted', confirm.close);

  const all = subs.data ?? [];
  const list = all.filter((s) => scope === 'all' || (scope === 'company' ? !s.project_id : !!s.project_id));
  const active = all.filter((s) => s.active);

  const sumBy = (arr: Subscription[]) =>
    arr.reduce<Record<string, number>>((acc, s) => ((acc[s.currency] = (acc[s.currency] ?? 0) + s.monthly_equivalent), acc), {});
  const fmt = (m: Record<string, number>) =>
    Object.keys(m).length ? (
      <span className="flex flex-col">
        {Object.entries(m).map(([c, v]) => (
          <span key={c}>{money(v, c)}</span>
        ))}
      </span>
    ) : (
      money(0)
    );
  const dueSoon = active.filter((s) => s.next_renewal && (new Date(s.next_renewal).getTime() - Date.now()) / 86400000 <= 7).length;

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        subtitle="Company-wide and project-specific recurring costs."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setModal('new')}>
            Add subscription
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total per month" value={fmt(sumBy(active))} sub="All active, yearly spread monthly" />
        <Stat label="Company-wide / month" value={fmt(sumBy(active.filter((s) => !s.project_id)))} sub="Overhead, not tied to a project" />
        <Stat label="Project-specific / month" value={fmt(sumBy(active.filter((s) => s.project_id)))} />
        <Stat label="Due within 7 days" value={dueSoon} tone={dueSoon ? 'neg' : undefined} sub={`${active.length} active subscriptions`} />
      </div>

      <Card padded={false}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <Segmented
            value={scope}
            onChange={setScope}
            items={[
              { value: 'all', label: 'All' },
              { value: 'company', label: 'Company-wide' },
              { value: 'projects', label: 'Projects' },
            ]}
          />
        </div>
        {subs.isLoading ? (
          <Spinner />
        ) : list.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Service</Th>
                <Th>Belongs to</Th>
                <Th className="hidden md:table-cell">Billing</Th>
                <Th className="text-right">Amount</Th>
                <Th className="hidden text-right lg:table-cell">≈ / month</Th>
                <Th>Next renewal</Th>
                <Th className="hidden xl:table-cell">Last paid</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className={cx('group hover:bg-subtle/60', !s.active && 'opacity-55')}>
                  <Td>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-faint">{s.vendor || '—'}</div>
                  </Td>
                  <Td>
                    {s.project_id ? (
                      <Link to={`/projects/${s.project_id}?tab=subscriptions`} className="inline-flex items-center gap-1.5 text-[13px] hover:underline">
                        <ColorDot color={s.project_color} className="size-2" /> {s.project_name}
                      </Link>
                    ) : (
                      <Badge>Company-wide</Badge>
                    )}
                  </Td>
                  <Td className="hidden text-muted md:table-cell">{CYCLE[s.billing_cycle]}</Td>
                  <Td className="text-right font-medium tabular">{money(s.amount, s.currency)}</Td>
                  <Td className="hidden text-right tabular text-muted lg:table-cell">{money(s.monthly_equivalent, s.currency)}</Td>
                  <Td className="text-[13px] whitespace-nowrap">{s.active ? <RenewalBadge date={s.next_renewal} /> : <Badge>Inactive</Badge>}</Td>
                  <Td className="hidden text-[13px] text-muted xl:table-cell">{date(s.last_paid)}</Td>
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
          <EmptyState
            icon={<CalendarClock className="size-5" />}
            title="No subscriptions here"
            text="Track tools like Google Workspace, Slack, Jira, hosting and licenses. Record each payment to keep balances accurate."
          />
        )}
      </Card>

      <SubscriptionFormModal open={!!modal} onClose={() => setModal(null)} sub={modal === 'new' ? undefined : modal ?? undefined} />
      <PaySubscriptionModal open={!!paying} onClose={() => setPaying(null)} sub={paying!} />
      <ConfirmDialog
        open={!!confirm.target}
        onClose={confirm.close}
        onConfirm={() => rm.mutate(confirm.target!.id)}
        loading={rm.isPending}
        title="Delete subscription?"
        text="Past payments stay recorded as expenses. To just stop tracking it, edit it and switch it to inactive."
      />
    </div>
  );
}
