export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', headers: {} };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch('/api' + url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/auth/')) window.dispatchEvent(new Event('ph:unauthorized'));
    throw new ApiError(res.status, data.error || res.statusText);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  patch: <T>(url: string, body: unknown) => request<T>('PATCH', url, body),
  del: <T>(url: string) => request<T>('DELETE', url),
};

// ---------- Types ----------
export type Status = 'opportunity' | 'active' | 'on_hold' | 'completed' | 'lost' | 'cancelled';

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'member';
  created_at?: string;
}

export interface Project {
  id: number;
  name: string;
  code: string | null;
  client: string | null;
  description: string;
  status: Status;
  currency: string;
  contract_value: number | null;
  probability: number | null;
  start_date: string | null;
  end_date: string | null;
  owner_id: number | null;
  owner_name: string | null;
  jira_url: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  income_received: number;
  income_expected: number;
  expenses_total: number;
  balance: number;
  monthly_burn: number;
  team_count: number;
  document_count: number;
}

export interface Income {
  id: number;
  project_id: number;
  project_name?: string;
  project_color?: string;
  currency?: string;
  description: string;
  reference: string | null;
  amount: number;
  status: 'received' | 'expected';
  date: string;
  notes: string;
  created_by_name?: string;
}

export type ExpenseCategory =
  | 'salary' | 'subscription' | 'contractor' | 'software' | 'hardware' | 'travel' | 'marketing' | 'office' | 'tax' | 'other';

export interface Expense {
  id: number;
  project_id: number | null;
  project_name?: string | null;
  project_color?: string | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: string;
  date: string;
  person_id: number | null;
  person_name?: string | null;
  subscription_id: number | null;
  subscription_name?: string | null;
  notes: string;
  created_by_name?: string;
}

export interface Person {
  id: number;
  name: string;
  title: string | null;
  email: string | null;
  monthly_salary: number;
  currency: string;
  employment_type: 'full_time' | 'part_time' | 'contractor' | 'freelancer';
  active: boolean;
  notes: string;
  allocated_percent: number;
  total_paid: number;
  allocations: {
    id: number;
    project_id: number;
    project_name: string;
    project_color: string;
    percent: number;
    role: string | null;
    monthly_cost: number;
    currency: string;
  }[];
}

export interface Allocation {
  id: number;
  project_id: number;
  person_id: number;
  person_name: string;
  person_title: string | null;
  monthly_salary: number;
  salary_currency: string;
  role: string | null;
  percent: number;
  monthly_cost: number;
  start_date: string | null;
  end_date: string | null;
  notes: string;
  is_current: boolean;
}

export interface Subscription {
  id: number;
  project_id: number | null;
  project_name: string | null;
  project_color: string | null;
  name: string;
  vendor: string | null;
  amount: number;
  currency: string;
  billing_cycle: 'monthly' | 'quarterly' | 'yearly' | 'one_time';
  start_date: string | null;
  next_renewal: string | null;
  active: boolean;
  notes: string;
  monthly_equivalent: number;
  last_paid: string | null;
  total_paid: number;
}

export interface Doc {
  id: number;
  project_id: number;
  title: string;
  kind: 'file' | 'link';
  url: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  category: string;
  uploaded_by_name: string | null;
  created_at: string;
}

export interface Note {
  id: number;
  body: string;
  author_name: string | null;
  author_id: number | null;
  created_at: string;
}

export interface CurrencyTotals {
  currency: string;
  project_count: number;
  income_received: number;
  income_expected: number;
  project_expenses: number;
  overhead_expenses: number;
  monthly_payroll: number;
  monthly_subscriptions: number;
  pipeline_value: number;
  pipeline_weighted: number;
}

export interface Dashboard {
  counts: { ongoing: number; opportunities: number; past: number; people: number };
  currencies: CurrencyTotals[];
  monthly: { month: string; currency: string; income: number; expense: number }[];
  renewals: (Pick<Subscription, 'id' | 'name' | 'vendor' | 'amount' | 'currency' | 'billing_cycle' | 'next_renewal'> & {
    project_name: string | null;
    project_id: number | null;
  })[];
  recent: {
    type: 'income' | 'expense';
    id: number;
    date: string;
    description: string;
    amount: number;
    currency: string;
    project_id: number | null;
    project_name: string | null;
    project_color: string | null;
    extra: string;
  }[];
}
