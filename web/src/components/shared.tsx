import { Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Project } from '../lib/api';
import { STATUS, daysUntil, money, runway } from '../lib/format';
import { Badge, ColorDot, IconButton, ProgressBar, cx } from './ui';

export function RowActions({ onEdit, onDelete, children }: { onEdit?: () => void; onDelete?: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
      {children}
      {onEdit && (
        <IconButton onClick={onEdit} title="Edit">
          <Pencil className="size-3.5" />
        </IconButton>
      )}
      {onDelete && (
        <IconButton onClick={onDelete} title="Delete" className="hover:!text-neg">
          <Trash2 className="size-3.5" />
        </IconButton>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: Project['status'] }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

export function Balance({ value, currency, className }: { value: number; currency: string; className?: string }) {
  return <span className={cx('tabular', value < 0 ? 'text-neg' : 'text-ink', className)}>{money(value, currency)}</span>;
}

export function RunwayText({ balance, burn }: { balance: number; burn: number }) {
  const r = runway(balance, burn);
  if (r === null) return <span className="text-faint">No monthly costs</span>;
  if (r <= 0) return <span className="text-neg">Over budget</span>;
  return <span className={cx(r < 2 ? 'text-warn' : 'text-muted')}>{r >= 24 ? '24+ months' : `${r.toFixed(1)} months`} runway</span>;
}

export function RenewalBadge({ date }: { date: string | null }) {
  if (!date) return <span className="text-faint">—</span>;
  const d = daysUntil(date);
  if (d < 0) return <Badge tone="neg">Overdue {Math.abs(d)}d</Badge>;
  if (d === 0) return <Badge tone="warn">Today</Badge>;
  if (d <= 7) return <Badge tone="warn">in {d}d</Badge>;
  return <span className="text-muted">in {d} days</span>;
}

export function ProjectCard({ p }: { p: Project }) {
  const isOpp = p.status === 'opportunity';
  const received = p.contract_value ? (p.income_received / p.contract_value) * 100 : 0;
  return (
    <Link
      to={`/projects/${p.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: p.color }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ColorDot color={p.color} />
            <h3 className="truncate font-semibold tracking-tight">{p.name}</h3>
          </div>
          <div className="mt-0.5 truncate pl-[18px] text-[13px] text-muted">{p.client || 'No client'}{p.code ? ` · ${p.code}` : ''}</div>
        </div>
        <StatusBadge status={p.status} />
      </div>

      {isOpp ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-faint">Estimated value</div>
            <div className="mt-0.5 text-lg font-semibold tabular">{p.contract_value ? money(p.contract_value, p.currency) : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-faint">Win chance</div>
            <div className="mt-0.5 text-lg font-semibold tabular">{p.probability ?? '—'}%</div>
          </div>
          <div className="col-span-2">
            <ProgressBar value={p.probability ?? 0} />
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <div className="text-xs text-faint">Available balance</div>
            <Balance value={p.balance} currency={p.currency} className="mt-0.5 block text-2xl font-semibold tracking-tight" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <div className="text-faint">Received</div>
              <div className="tabular font-medium text-pos">{money(p.income_received, p.currency)}</div>
            </div>
            <div>
              <div className="text-faint">Spent</div>
              <div className="tabular font-medium">{money(p.expenses_total, p.currency)}</div>
            </div>
          </div>
          {p.contract_value ? (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs text-faint">
                <span>Collected of {money(p.contract_value, p.currency, { compact: true })}</span>
                <span className="tabular">{Math.round(received)}%</span>
              </div>
              <ProgressBar value={received} tone="pos" />
            </div>
          ) : null}
        </>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-xs text-faint [margin-top:1.25rem]">
        <span>
          {p.team_count} {p.team_count === 1 ? 'person' : 'people'} · {p.document_count} {p.document_count === 1 ? 'doc' : 'docs'}
        </span>
        {!isOpp && p.monthly_burn > 0 && <span className="tabular">{money(p.monthly_burn, p.currency, { compact: true })}/mo</span>}
      </div>
    </Link>
  );
}
