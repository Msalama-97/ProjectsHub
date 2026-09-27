import type { ExpenseCategory, Status } from './api';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'EGP', 'SAR', 'AED', 'KWD', 'QAR', 'CAD', 'AUD', 'CHF', 'TRY', 'INR'];

export function money(value: number | null | undefined, currency = 'USD', opts: { compact?: boolean; sign?: boolean } = {}) {
  const v = Number(value ?? 0);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: opts.compact && Math.abs(v) >= 10000 ? 'compact' : 'standard',
      maximumFractionDigits: opts.compact ? 1 : 2,
      minimumFractionDigits: opts.compact ? 0 : Number.isInteger(v) ? 0 : 2,
      signDisplay: opts.sign ? 'exceptZero' : 'auto',
    }).format(v);
  } catch {
    return `${currency} ${v.toLocaleString()}`;
  }
}

export function date(d: string | null | undefined, style: 'short' | 'long' = 'short') {
  if (!d) return '—';
  const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d);
  return dt.toLocaleDateString('en-GB', style === 'short' ? { day: 'numeric', month: 'short', year: 'numeric' } : { dateStyle: 'long' });
}

export function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'short' });
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function thisMonth() {
  return today().slice(0, 7);
}

export function daysUntil(d: string) {
  const ms = new Date(d + 'T00:00:00').getTime() - new Date(today() + 'T00:00:00').getTime();
  return Math.round(ms / 86400000);
}

export function fileSize(bytes: number | null) {
  if (!bytes) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
}

export const STATUS: Record<Status, { label: string; tone: Tone }> = {
  opportunity: { label: 'Opportunity', tone: 'accent' },
  active: { label: 'Active', tone: 'pos' },
  on_hold: { label: 'On hold', tone: 'warn' },
  completed: { label: 'Completed', tone: 'neutral' },
  lost: { label: 'Lost', tone: 'neg' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export type Tone = 'neutral' | 'accent' | 'pos' | 'neg' | 'warn';

export const CATEGORY: Record<ExpenseCategory, string> = {
  salary: 'Salaries',
  subscription: 'Subscriptions',
  contractor: 'Contractors',
  software: 'Software',
  hardware: 'Hardware',
  travel: 'Travel',
  marketing: 'Marketing',
  office: 'Office & rent',
  tax: 'Taxes & fees',
  other: 'Other',
};

export const CYCLE: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  one_time: 'One-time',
};

export const EMPLOYMENT: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contractor: 'Contractor',
  freelancer: 'Freelancer',
};

export const PROJECT_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#64748b'];

export function runway(balance: number, burn: number) {
  if (burn <= 0) return null;
  return balance / burn;
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows
    .map((r) => r.map((c) => {
      const s = c === null || c === undefined ? '' : String(c);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
