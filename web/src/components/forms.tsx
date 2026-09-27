import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Upload, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, type Allocation, type Expense, type ExpenseCategory, type Income, type Person, type Project, type Subscription, type User } from '../lib/api';
import { CATEGORY, CURRENCIES, CYCLE, EMPLOYMENT, PROJECT_COLORS, STATUS, money, thisMonth, today } from '../lib/format';
import { clean, useForm, usePeople, useProjects, useSave, useUsers } from '../lib/hooks';
import { Button, Field, Input, Modal, Segmented, Select, Textarea, Toggle, cx } from './ui';

interface BaseProps {
  open: boolean;
  onClose: () => void;
}

function only<P extends BaseProps>(Inner: (p: P) => ReactNode) {
  return (p: P) => (p.open ? <Inner {...p} /> : null);
}

function Footer({ onClose, loading, form, label = 'Save' }: { onClose: () => void; loading?: boolean; form: string; label?: string }) {
  return (
    <>
      <Button type="button" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" form={form} loading={loading}>
        {label}
      </Button>
    </>
  );
}

function CurrencySelect(props: { value: string; onChange: (e: { target: { value: string } }) => void; disabled?: boolean }) {
  const list = CURRENCIES.includes(props.value) ? CURRENCIES : [props.value, ...CURRENCIES];
  return (
    <Select value={props.value} onChange={props.onChange} disabled={props.disabled}>
      {list.map((c) => (
        <option key={c}>{c}</option>
      ))}
    </Select>
  );
}

// ======================= Project =======================
export const ProjectFormModal = only(function ProjectForm({
  onClose,
  project,
  defaultStatus = 'active',
  onSaved,
}: BaseProps & { project?: Project; defaultStatus?: Project['status']; onSaved?: (p: Project) => void }) {
  const users = useUsers();
  const f = useForm({
    name: project?.name ?? '',
    code: project?.code ?? '',
    client: project?.client ?? '',
    description: project?.description ?? '',
    status: project?.status ?? defaultStatus,
    currency: project?.currency ?? 'USD',
    contract_value: project?.contract_value?.toString() ?? '',
    probability: project?.probability?.toString() ?? (defaultStatus === 'opportunity' ? '50' : ''),
    start_date: project?.start_date ?? '',
    end_date: project?.end_date ?? '',
    owner_id: project?.owner_id?.toString() ?? '',
    jira_url: project?.jira_url ?? '',
    color: project?.color ?? PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
  });
  const v = f.values;
  const save = useSave(
    (body: unknown) => (project ? api.patch<Project>(`/projects/${project.id}`, body) : api.post<Project>('/projects', body)),
    project ? 'Project updated' : 'Project created',
    (p) => {
      onClose();
      onSaved?.(p);
    },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = clean(v, ['contract_value', 'probability', 'owner_id']);
    if (v.status !== 'opportunity' && !project?.probability) body.probability = null;
    save.mutate(body);
  };
  const isOpp = v.status === 'opportunity';

  return (
    <Modal
      open
      onClose={onClose}
      title={project ? 'Edit project' : 'New project'}
      width="max-w-2xl"
      footer={<Footer onClose={onClose} form="project-form" loading={save.isPending} label={project ? 'Save changes' : 'Create project'} />}
    >
      <form id="project-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <Field label="Project name" className="sm:col-span-4">
          <Input required autoFocus value={v.name} onChange={f.set('name')} placeholder="e.g. Website revamp" />
        </Field>
        <Field label="Code" className="sm:col-span-2">
          <Input value={v.code} onChange={f.set('code')} placeholder="WEB" />
        </Field>
        <Field label="Client" className="sm:col-span-3">
          <Input value={v.client} onChange={f.set('client')} placeholder="Client or company" />
        </Field>
        <Field label="Status" className="sm:col-span-3">
          <Select value={v.status} onChange={f.set('status') as never}>
            {Object.entries(STATUS).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Currency" className="sm:col-span-2" hint={project ? 'Changing it relabels existing amounts' : undefined}>
          <CurrencySelect value={v.currency} onChange={f.set('currency')} />
        </Field>
        <Field label={isOpp ? 'Estimated value' : 'Contract value / budget'} className={isOpp ? 'sm:col-span-2' : 'sm:col-span-4'}>
          <Input type="number" min="0" step="0.01" value={v.contract_value} onChange={f.set('contract_value')} placeholder="0" />
        </Field>
        {isOpp && (
          <Field label="Win chance %" className="sm:col-span-2">
            <Input type="number" min="0" max="100" value={v.probability} onChange={f.set('probability')} />
          </Field>
        )}
        <Field label={isOpp ? 'Expected start' : 'Start date'} className="sm:col-span-3">
          <Input type="date" value={v.start_date} onChange={f.set('start_date')} />
        </Field>
        <Field label={isOpp ? 'Expected end' : 'End date'} className="sm:col-span-3">
          <Input type="date" value={v.end_date} onChange={f.set('end_date')} />
        </Field>
        <Field label="Owner" className="sm:col-span-3">
          <Select value={v.owner_id} onChange={f.set('owner_id')}>
            <option value="">—</option>
            {users.data?.map((u: User) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Jira link" className="sm:col-span-3">
          <Input value={v.jira_url} onChange={f.set('jira_url')} placeholder="https://yourteam.atlassian.net/…" />
        </Field>
        <Field label="Description" className="sm:col-span-6">
          <Textarea value={v.description} onChange={f.set('description')} placeholder="Scope, goals, key contacts, terms…" rows={5} />
        </Field>
        <div className="sm:col-span-6">
          <span className="mb-1.5 block text-[13px] font-medium text-muted">Color</span>
          <div className="flex gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => f.set('color')(c)}
                className={cx('size-6 rounded-full ring-offset-2 ring-offset-surface transition', v.color === c && 'ring-2 ring-ink')}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
});

// ======================= Income =======================
export const IncomeFormModal = only(function IncomeForm({
  onClose,
  projectId,
  income,
}: BaseProps & { projectId?: number; income?: Income }) {
  const projects = useProjects();
  const f = useForm({
    project_id: (income?.project_id ?? projectId ?? '').toString(),
    description: income?.description ?? '',
    reference: income?.reference ?? '',
    amount: income?.amount?.toString() ?? '',
    status: income?.status ?? 'received',
    date: income?.date ?? today(),
    notes: income?.notes ?? '',
  });
  const v = f.values;
  const cur = projects.data?.find((p) => p.id === Number(v.project_id))?.currency;
  const save = useSave(
    (body: unknown) => (income ? api.patch(`/incomes/${income.id}`, body) : api.post('/incomes', body)),
    income ? 'Payment updated' : 'Payment recorded',
    onClose,
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={income ? 'Edit incoming payment' : 'Record incoming payment'}
      description="Money received from (or expected from) the client."
      footer={<Footer onClose={onClose} form="income-form" loading={save.isPending} />}
    >
      <form
        id="income-form"
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(clean(v, ['project_id', 'amount']));
        }}
      >
        {!projectId && !income && (
          <Field label="Project" className="col-span-2">
            <Select required value={v.project_id} onChange={f.set('project_id')}>
              <option value="">Select a project…</option>
              {projects.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.currency})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="col-span-2">
          <Segmented
            value={v.status}
            onChange={(s) => f.set('status')(s)}
            items={[
              { value: 'received', label: 'Received' },
              { value: 'expected', label: 'Expected / invoiced' },
            ]}
          />
        </div>
        <Field label="Description" className="col-span-2">
          <Input required autoFocus value={v.description} onChange={f.set('description')} placeholder="e.g. Milestone 1 payment" />
        </Field>
        <Field label={`Amount${cur ? ` (${cur})` : ''}`}>
          <Input required type="number" min="0" step="0.01" value={v.amount} onChange={f.set('amount')} />
        </Field>
        <Field label={v.status === 'expected' ? 'Expected date' : 'Date received'}>
          <Input required type="date" value={v.date} onChange={f.set('date')} />
        </Field>
        <Field label="Reference" className="col-span-2">
          <Input value={v.reference} onChange={f.set('reference')} placeholder="Invoice #, PO, transfer ref…" />
        </Field>
        <Field label="Notes" className="col-span-2">
          <Textarea rows={2} className="min-h-0" value={v.notes} onChange={f.set('notes')} />
        </Field>
      </form>
    </Modal>
  );
});

// ======================= Expense =======================
export const ExpenseFormModal = only(function ExpenseForm({
  onClose,
  projectId,
  expense,
  allowOverall = true,
}: BaseProps & { projectId?: number | null; expense?: Expense; allowOverall?: boolean }) {
  const projects = useProjects();
  const people = usePeople();
  const f = useForm({
    project_id: (expense ? expense.project_id ?? '' : projectId ?? '').toString(),
    category: (expense?.category ?? 'other') as ExpenseCategory,
    description: expense?.description ?? '',
    amount: expense?.amount?.toString() ?? '',
    currency: expense?.currency ?? 'USD',
    date: expense?.date ?? today(),
    person_id: expense?.person_id?.toString() ?? '',
    notes: expense?.notes ?? '',
  });
  const v = f.values;
  const project = projects.data?.find((p) => p.id === Number(v.project_id));
  const save = useSave(
    (body: unknown) => (expense ? api.patch(`/expenses/${expense.id}`, body) : api.post('/expenses', body)),
    expense ? 'Expense updated' : 'Expense added',
    onClose,
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={expense ? 'Edit expense' : 'Add expense'}
      footer={<Footer onClose={onClose} form="expense-form" loading={save.isPending} />}
    >
      <form
        id="expense-form"
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const body = clean(v, ['project_id', 'amount', 'person_id']);
          if (body.project_id) delete body.currency;
          save.mutate(body);
        }}
      >
        {projectId === undefined && (
          <Field label="Charged to" className="col-span-2">
            <Select value={v.project_id} onChange={f.set('project_id')}>
              {allowOverall && <option value="">Company / overall (not a project)</option>}
              {projects.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.currency})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Description" className="col-span-2">
          <Input required autoFocus value={v.description} onChange={f.set('description')} placeholder="What was it for?" />
        </Field>
        <Field label="Category">
          <Select value={v.category} onChange={f.set('category') as never}>
            {Object.entries(CATEGORY).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input required type="date" value={v.date} onChange={f.set('date')} />
        </Field>
        <Field label={`Amount${project ? ` (${project.currency})` : ''}`} className={project ? 'col-span-2' : ''}>
          <Input required type="number" min="0" step="0.01" value={v.amount} onChange={f.set('amount')} />
        </Field>
        {!project && (
          <Field label="Currency">
            <CurrencySelect value={v.currency} onChange={f.set('currency')} />
          </Field>
        )}
        {(v.category === 'salary' || v.category === 'contractor') && (
          <Field label="Person" className="col-span-2">
            <Select value={v.person_id} onChange={f.set('person_id')}>
              <option value="">—</option>
              {people.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Notes" className="col-span-2">
          <Textarea rows={2} className="min-h-0" value={v.notes} onChange={f.set('notes')} />
        </Field>
      </form>
    </Modal>
  );
});

// ======================= Person =======================
export const PersonFormModal = only(function PersonForm({ onClose, person }: BaseProps & { person?: Person }) {
  const f = useForm({
    name: person?.name ?? '',
    title: person?.title ?? '',
    email: person?.email ?? '',
    monthly_salary: person?.monthly_salary?.toString() ?? '',
    currency: person?.currency ?? 'USD',
    employment_type: person?.employment_type ?? 'full_time',
    active: person?.active ?? true,
    notes: person?.notes ?? '',
  });
  const v = f.values;
  const save = useSave(
    (body: unknown) => (person ? api.patch(`/people/${person.id}`, body) : api.post('/people', body)),
    person ? 'Person updated' : 'Person added',
    onClose,
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={person ? 'Edit team member' : 'Add team member'}
      footer={<Footer onClose={onClose} form="person-form" loading={save.isPending} />}
    >
      <form
        id="person-form"
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ ...clean(v, ['monthly_salary']), monthly_salary: Number(v.monthly_salary || 0) });
        }}
      >
        <Field label="Full name" className="col-span-2">
          <Input required autoFocus value={v.name} onChange={f.set('name')} />
        </Field>
        <Field label="Job title">
          <Input value={v.title} onChange={f.set('title')} placeholder="e.g. Backend engineer" />
        </Field>
        <Field label="Email">
          <Input type="email" value={v.email} onChange={f.set('email')} />
        </Field>
        <Field label="Monthly salary / cost">
          <Input type="number" min="0" step="0.01" value={v.monthly_salary} onChange={f.set('monthly_salary')} />
        </Field>
        <Field label="Currency">
          <CurrencySelect value={v.currency} onChange={f.set('currency')} />
        </Field>
        <Field label="Employment">
          <Select value={v.employment_type} onChange={f.set('employment_type') as never}>
            {Object.entries(EMPLOYMENT).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end pb-2">
          <Toggle checked={v.active} onChange={(b) => f.set('active')(b)} label="Active" />
        </div>
        <Field label="Notes" className="col-span-2">
          <Textarea rows={2} className="min-h-0" value={v.notes} onChange={f.set('notes')} />
        </Field>
      </form>
    </Modal>
  );
});

// ======================= Allocation =======================
export const AllocationFormModal = only(function AllocationForm({
  onClose,
  project,
  allocation,
}: BaseProps & { project: Project; allocation?: Allocation }) {
  const people = usePeople();
  const f = useForm({
    person_id: allocation?.person_id?.toString() ?? '',
    role: allocation?.role ?? '',
    percent: allocation?.percent?.toString() ?? '100',
    monthly_cost: allocation?.monthly_cost?.toString() ?? '',
    start_date: allocation?.start_date ?? project.start_date ?? today(),
    end_date: allocation?.end_date ?? '',
    notes: allocation?.notes ?? '',
  });
  const v = f.values;
  const [costTouched, setCostTouched] = useState(!!allocation);
  const person = people.data?.find((p) => p.id === Number(v.person_id));
  const suggested = person && person.currency === project.currency ? (person.monthly_salary * Number(v.percent || 0)) / 100 : null;

  const onPersonOrPercent = (key: 'person_id' | 'percent', value: string) => {
    const next = { ...v, [key]: value };
    const p = people.data?.find((x) => x.id === Number(next.person_id));
    f.setValues({
      ...next,
      role: key === 'person_id' && !v.role && p?.title ? p.title : next.role,
      monthly_cost:
        !costTouched && p && p.currency === project.currency ? String(Math.round((p.monthly_salary * Number(next.percent || 0)) / 100 * 100) / 100) : next.monthly_cost,
    });
  };

  const save = useSave(
    (body: unknown) => (allocation ? api.patch(`/allocations/${allocation.id}`, body) : api.post('/allocations', body)),
    allocation ? 'Allocation updated' : 'Person assigned',
    onClose,
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={allocation ? 'Edit allocation' : 'Assign person to project'}
      description="The monthly cost is what this person costs this project each month."
      footer={<Footer onClose={onClose} form="alloc-form" loading={save.isPending} />}
    >
      <form
        id="alloc-form"
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ ...clean(v, ['person_id', 'percent', 'monthly_cost']), project_id: project.id, monthly_cost: Number(v.monthly_cost || 0) });
        }}
      >
        <Field label="Person" className="col-span-2">
          <Select required disabled={!!allocation} value={v.person_id} onChange={(e) => onPersonOrPercent('person_id', e.target.value)}>
            <option value="">Select a team member…</option>
            {people.data
              ?.filter((p) => p.active || p.id === allocation?.person_id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.allocated_percent}% allocated
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Role on project">
          <Input value={v.role} onChange={f.set('role')} />
        </Field>
        <Field label="Allocation %">
          <Input type="number" min="0" max="100" value={v.percent} onChange={(e) => onPersonOrPercent('percent', e.target.value)} />
        </Field>
        <Field
          label={`Monthly cost (${project.currency})`}
          className="col-span-2"
          hint={
            person
              ? person.currency === project.currency
                ? `Salary ${money(person.monthly_salary, person.currency)} × ${v.percent || 0}% = ${money(suggested ?? 0, project.currency)}`
                : `Salary is in ${person.currency} (${money(person.monthly_salary, person.currency)}) — enter the cost in ${project.currency}`
              : undefined
          }
        >
          <Input
            type="number"
            min="0"
            step="0.01"
            value={v.monthly_cost}
            onChange={(e) => {
              setCostTouched(true);
              f.set('monthly_cost')(e);
            }}
          />
        </Field>
        <Field label="From">
          <Input type="date" value={v.start_date} onChange={f.set('start_date')} />
        </Field>
        <Field label="Until" hint="Leave empty if ongoing">
          <Input type="date" value={v.end_date} onChange={f.set('end_date')} />
        </Field>
      </form>
    </Modal>
  );
});

// ======================= Subscription =======================
export const SubscriptionFormModal = only(function SubscriptionForm({
  onClose,
  projectId,
  sub,
}: BaseProps & { projectId?: number | null; sub?: Subscription }) {
  const projects = useProjects();
  const f = useForm({
    project_id: (sub ? sub.project_id ?? '' : projectId ?? '').toString(),
    name: sub?.name ?? '',
    vendor: sub?.vendor ?? '',
    amount: sub?.amount?.toString() ?? '',
    currency: sub?.currency ?? 'USD',
    billing_cycle: sub?.billing_cycle ?? 'monthly',
    start_date: sub?.start_date ?? today(),
    next_renewal: sub?.next_renewal ?? '',
    active: sub?.active ?? true,
    notes: sub?.notes ?? '',
  });
  const v = f.values;
  const project = projects.data?.find((p) => p.id === Number(v.project_id));
  const save = useSave(
    (body: unknown) => (sub ? api.patch(`/subscriptions/${sub.id}`, body) : api.post('/subscriptions', body)),
    sub ? 'Subscription updated' : 'Subscription added',
    onClose,
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={sub ? 'Edit subscription' : 'Add subscription'}
      description="Recurring tools and services. Use “Record payment” each time it's charged."
      footer={<Footer onClose={onClose} form="sub-form" loading={save.isPending} />}
    >
      <form
        id="sub-form"
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const body = clean(v, ['project_id', 'amount']);
          if (body.project_id) delete body.currency;
          save.mutate(body);
        }}
      >
        {projectId === undefined && (
          <Field label="Belongs to" className="col-span-2">
            <Select value={v.project_id} onChange={f.set('project_id')}>
              <option value="">Company-wide (overall)</option>
              {projects.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.currency})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Name">
          <Input required autoFocus value={v.name} onChange={f.set('name')} placeholder="e.g. Figma Professional" />
        </Field>
        <Field label="Vendor">
          <Input value={v.vendor} onChange={f.set('vendor')} placeholder="e.g. Figma" />
        </Field>
        <Field label={`Amount per cycle${project ? ` (${project.currency})` : ''}`} className={project ? 'col-span-2' : ''}>
          <Input required type="number" min="0" step="0.01" value={v.amount} onChange={f.set('amount')} />
        </Field>
        {!project && (
          <Field label="Currency">
            <CurrencySelect value={v.currency} onChange={f.set('currency')} />
          </Field>
        )}
        <Field label="Billing cycle">
          <Select value={v.billing_cycle} onChange={f.set('billing_cycle') as never}>
            {Object.entries(CYCLE).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Next renewal">
          <Input type="date" value={v.next_renewal} onChange={f.set('next_renewal')} />
        </Field>
        <Field label="Notes" className="col-span-2">
          <Textarea rows={2} className="min-h-0" value={v.notes} onChange={f.set('notes')} placeholder="Seats, account owner, login email…" />
        </Field>
        <div className="col-span-2">
          <Toggle checked={v.active} onChange={(b) => f.set('active')(b)} label="Active" />
        </div>
      </form>
    </Modal>
  );
});

// ======================= Pay subscription =======================
export const PaySubscriptionModal = only(function PaySub({ onClose, sub }: BaseProps & { sub: Subscription }) {
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(String(sub.amount));
  const save = useSave(() => api.post(`/subscriptions/${sub.id}/pay`, { date, amount: Number(amount) }), 'Payment recorded', onClose);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Record payment — ${sub.name}`}
      description={`Adds an expense${sub.project_name ? ` to ${sub.project_name}` : ' to company overhead'} and moves the renewal date forward.`}
      width="max-w-md"
      footer={<Footer onClose={onClose} form="pay-form" loading={save.isPending} label="Record payment" />}
    >
      <form
        id="pay-form"
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <Field label={`Amount (${sub.currency})`}>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Paid on">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
});

// ======================= Payroll =======================
export const PayrollModal = only(function Payroll({ onClose, project, allocations }: BaseProps & { project: Project; allocations: Allocation[] }) {
  const [period, setPeriod] = useState(thisMonth());
  const start = `${period}-01`;
  const [y, m] = period.split('-').map(Number);
  const endD = new Date(y, m, 0);
  const end = `${y}-${String(m).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
  const eligible = allocations.filter(
    (a) => a.monthly_cost > 0 && (!a.start_date || a.start_date <= end) && (!a.end_date || a.end_date >= start),
  );
  const total = eligible.reduce((s, a) => s + a.monthly_cost, 0);
  const save = useSave(
    () => api.post<{ created: number }>(`/projects/${project.id}/payroll`, { period }),
    undefined,
    (r) => {
      onClose();
      if (r.created) toast.success(`Recorded ${r.created} salary expense${r.created > 1 ? 's' : ''}`);
      else toast.info('Payroll for this month was already recorded');
    },
  );
  return (
    <Modal
      open
      onClose={onClose}
      title="Record monthly payroll"
      description="Creates one salary expense per assigned person, using their monthly cost. Safe to run twice — duplicates are skipped."
      footer={<Footer onClose={onClose} form="payroll-form" loading={save.isPending} label={`Record ${money(total, project.currency)}`} />}
    >
      <form
        id="payroll-form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <Field label="Month">
          <Input type="month" required value={period} onChange={(e) => setPeriod(e.target.value)} />
        </Field>
        <div className="mt-4 divide-y divide-line rounded-lg border border-line">
          {eligible.length === 0 && <div className="p-4 text-sm text-muted">No one is assigned with a monthly cost in this month.</div>}
          {eligible.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>
                {a.person_name} <span className="text-faint">· {a.percent}%</span>
              </span>
              <span className="tabular font-medium">{money(a.monthly_cost, project.currency)}</span>
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
});

// ======================= Document =======================
export const DocumentFormModal = only(function DocumentForm({ onClose, projectId }: BaseProps & { projectId: number }) {
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('general');
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const save = useSave(
    () => {
      if (mode === 'file') {
        const fd = new FormData();
        fd.append('project_id', String(projectId));
        fd.append('title', title);
        fd.append('category', category);
        fd.append('file', file!);
        return api.post('/documents', fd);
      }
      return api.post('/documents', { project_id: projectId, title, url, category });
    },
    'Document added',
    onClose,
  );
  return (
    <Modal
      open
      onClose={onClose}
      title="Add document"
      footer={<Footer onClose={onClose} form="doc-form" loading={save.isPending} label={mode === 'file' ? 'Upload' : 'Add link'} />}
    >
      <form
        id="doc-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === 'file' && !file) return;
          save.mutate(undefined);
        }}
      >
        <Segmented
          value={mode}
          onChange={setMode}
          items={[
            { value: 'file', label: 'Upload file' },
            { value: 'link', label: 'Add link' },
          ]}
        />
        {mode === 'file' ? (
          <div
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
            }}
            className={cx(
              'flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors',
              drag ? 'border-accent bg-accent-soft' : 'border-line hover:bg-subtle',
            )}
          >
            <Upload className="mb-2 size-5 text-faint" />
            {file ? (
              <div className="text-sm font-medium">{file.name}</div>
            ) : (
              <>
                <div className="text-sm font-medium">Drop a file or click to browse</div>
                <div className="mt-0.5 text-xs text-faint">Contracts, proposals, invoices, specs…</div>
              </>
            )}
            <input ref={input} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        ) : (
          <Field label="URL">
            <div className="relative">
              <Link2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <Input required className="pl-9" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Google Drive, Confluence, Notion…" />
            </div>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Title" hint="Optional — defaults to file name">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Type">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {['general', 'contract', 'proposal', 'invoice', 'specification', 'design', 'report', 'other'].map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </form>
    </Modal>
  );
});
