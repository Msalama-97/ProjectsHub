import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, FolderKanban, Plus, Search, Target } from 'lucide-react';
import type { Project } from '../lib/api';
import { date, money } from '../lib/format';
import { useProjects } from '../lib/hooks';
import { Button, Card, ColorDot, EmptyState, Input, PageHeader, Segmented, Spinner, Table, Tabs, Td, Th } from '../components/ui';
import { Balance, ProjectCard, StatusBadge } from '../components/shared';
import { ProjectFormModal } from '../components/forms';

type Group = 'ongoing' | 'opportunities' | 'past' | 'all';
const GROUPS: Record<Exclude<Group, 'all'>, Project['status'][]> = {
  ongoing: ['active', 'on_hold'],
  opportunities: ['opportunity'],
  past: ['completed', 'lost', 'cancelled'],
};

export default function Projects() {
  const [params, setParams] = useSearchParams();
  const group = (params.get('tab') as Group) || 'ongoing';
  const [q, setQ] = useState('');
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try {
      return (localStorage.getItem('ph-projects-view') as 'grid' | 'list') || 'grid';
    } catch {
      return 'grid';
    }
  });
  const [creating, setCreating] = useState(false);
  const nav = useNavigate();
  const all = useProjects();

  const counts = useMemo(() => {
    const c = { ongoing: 0, opportunities: 0, past: 0, all: all.data?.length ?? 0 };
    for (const p of all.data ?? []) {
      for (const [g, st] of Object.entries(GROUPS)) if (st.includes(p.status)) c[g as keyof typeof c]++;
    }
    return c;
  }, [all.data]);

  const list = (all.data ?? [])
    .filter((p) => group === 'all' || GROUPS[group].includes(p.status))
    .filter((p) => !q || `${p.name} ${p.client ?? ''} ${p.code ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  const setView2 = (v: 'grid' | 'list') => {
    setView(v);
    try {
      localStorage.setItem('ph-projects-view', v);
    } catch {
      /* ignore */
    }
  };

  const emptyIcon = group === 'opportunities' ? <Target className="size-5" /> : group === 'past' ? <Archive className="size-5" /> : <FolderKanban className="size-5" />;

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Ongoing work, upcoming opportunities and past projects."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            {group === 'opportunities' ? 'New opportunity' : 'New project'}
          </Button>
        }
      />

      <Tabs
        value={group}
        onChange={(g) => setParams(g === 'ongoing' ? {} : { tab: g })}
        items={[
          { value: 'ongoing', label: 'Ongoing', count: counts.ongoing },
          { value: 'opportunities', label: 'Opportunities', count: counts.opportunities },
          { value: 'past', label: 'Past', count: counts.past },
          { value: 'all', label: 'All', count: counts.all },
        ]}
      />

      <div className="my-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input className="pl-9" placeholder="Search projects or clients…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented
          value={view}
          onChange={setView2}
          items={[
            { value: 'grid', label: 'Cards' },
            { value: 'list', label: 'List' },
          ]}
        />
      </div>

      {all.isLoading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={emptyIcon}
            title={q ? 'No matches' : group === 'opportunities' ? 'No opportunities yet' : group === 'past' ? 'No past projects' : 'No projects here yet'}
            text={
              q
                ? 'Try a different search.'
                : group === 'opportunities'
                  ? 'Track leads and proposals here, with their estimated value and chance of winning.'
                  : 'Projects you create will show up here with their live balance.'
            }
            action={!q && group !== 'past' && <Button onClick={() => setCreating(true)}>Create one</Button>}
          />
        </Card>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <Card padded={false}>
          <Table>
            <thead>
              <tr>
                <Th>Project</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Dates</Th>
                <Th className="text-right">{group === 'opportunities' ? 'Est. value' : 'Received'}</Th>
                <Th className="text-right">{group === 'opportunities' ? 'Win chance' : 'Spent'}</Th>
                <Th className="text-right">{group === 'opportunities' ? 'Weighted' : 'Balance'}</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
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
                  <Td>
                    <StatusBadge status={p.status} />
                  </Td>
                  <Td className="hidden text-[13px] text-muted md:table-cell">
                    {date(p.start_date)} → {p.end_date ? date(p.end_date) : 'ongoing'}
                  </Td>
                  {p.status === 'opportunity' ? (
                    <>
                      <Td className="text-right tabular">{p.contract_value ? money(p.contract_value, p.currency) : '—'}</Td>
                      <Td className="text-right tabular text-muted">{p.probability ?? '—'}%</Td>
                      <Td className="text-right font-medium tabular">
                        {money(((p.contract_value ?? 0) * (p.probability ?? 50)) / 100, p.currency)}
                      </Td>
                    </>
                  ) : (
                    <>
                      <Td className="text-right tabular text-pos">{money(p.income_received, p.currency)}</Td>
                      <Td className="text-right tabular text-muted">{money(p.expenses_total, p.currency)}</Td>
                      <Td className="text-right font-medium">
                        <Balance value={p.balance} currency={p.currency} />
                      </Td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <ProjectFormModal
        open={creating}
        onClose={() => setCreating(false)}
        defaultStatus={group === 'opportunities' ? 'opportunity' : 'active'}
        onSaved={(p) => nav(`/projects/${p.id}`)}
      />
    </div>
  );
}
