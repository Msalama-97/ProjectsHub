import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChevronDown, LoaderCircle, X } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import type { Tone } from '../lib/format';

export const cx = (...c: ClassValue[]) => twMerge(clsx(c));

// ---------- Button ----------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }
>(function Button({ variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all select-none whitespace-nowrap',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-ink text-bg hover:opacity-90 shadow-sm',
        variant === 'secondary' && 'bg-surface text-ink border border-line hover:bg-subtle shadow-[0_1px_0_rgba(0,0,0,0.03)]',
        variant === 'ghost' && 'text-muted hover:text-ink hover:bg-subtle',
        variant === 'danger' && 'bg-neg text-white hover:opacity-90',
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        'inline-flex size-8 items-center justify-center rounded-lg text-faint hover:text-ink hover:bg-subtle transition-colors',
        className,
      )}
      {...rest}
    />
  );
}

// ---------- Form controls ----------
const control =
  'w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-faint transition-colors ' +
  'focus:outline-none focus:border-accent focus:ring-3 focus:ring-accent/15';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(control, 'h-9', className)} {...rest} />;
});

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, 'py-2 min-h-24 resize-y leading-relaxed', className)} {...rest} />;
}

export function Select({
  className,
  wrapClassName,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { wrapClassName?: string }) {
  return (
    <div className={cx('relative w-full', wrapClassName)}>
      <select className={cx(control, 'h-9 cursor-pointer appearance-none pr-8', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-faint" />
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 text-sm text-ink">
      <span className={cx('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line')}>
        <span
          className={cx(
            'absolute top-0.5 size-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}

// ---------- Surfaces ----------
export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={cx('rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.03)]', padded && 'p-5', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-subtle text-muted',
  accent: 'bg-accent-soft text-accent',
  pos: 'bg-pos-soft text-pos',
  neg: 'bg-neg-soft text-neg',
  warn: 'bg-warn-soft text-warn',
};

export function Badge({ tone = 'neutral', children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap', toneClasses[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'pos' | 'neg';
  icon?: ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <div className="flex items-center justify-between text-[13px] font-medium text-muted">
        {label}
        {icon && <span className="text-faint">{icon}</span>}
      </div>
      <div className={cx('mt-2 truncate text-2xl font-semibold tracking-tight tabular', tone === 'pos' && 'text-pos', tone === 'neg' && 'text-neg')}>
        {value}
      </div>
      {sub && <div className="mt-1 truncate text-xs text-faint">{sub}</div>}
    </Card>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; count?: number }[];
  className?: string;
}) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto border-b border-line', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cx(
            '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
            value === it.value ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {it.label}
          {it.count !== undefined && (
            <span className={cx('rounded-full px-1.5 text-[11px] tabular', value === it.value ? 'bg-ink text-bg' : 'bg-subtle text-muted')}>
              {it.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-subtle p-0.5">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          onClick={() => onChange(it.value)}
          className={cx(
            'rounded-md px-3 py-1 text-[13px] font-medium transition-all',
            value === it.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-subtle text-faint">{icon}</div>}
      <div className="text-sm font-medium text-ink">{title}</div>
      {text && <p className="mt-1 max-w-sm text-[13px] text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cx('flex items-center justify-center py-16 text-faint', className)}>
      <LoaderCircle className="size-5 animate-spin" />
    </div>
  );
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'pos' | 'neg' | 'warn' }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
      <div
        className={cx(
          'h-full rounded-full transition-all',
          tone === 'accent' && 'bg-accent',
          tone === 'pos' && 'bg-pos',
          tone === 'neg' && 'bg-neg',
          tone === 'warn' && 'bg-warn',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------- Modal ----------
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('animate-in relative my-8 w-full rounded-2xl border border-line bg-surface shadow-2xl', width)}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
          </div>
          <IconButton onClick={onClose} aria-label="Close" className="-mr-2 -mt-1">
            <X className="size-4" />
          </IconButton>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-2xl border-t border-line bg-subtle/60 px-6 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirmLabel = 'Delete',
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  text: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{text}</p>
    </Modal>
  );
}

/** Small hook for "confirm then delete" flows */
export function useConfirm<T>() {
  const [target, setTarget] = useState<T | null>(null);
  return { target, ask: setTarget, close: () => setTarget(null) };
}

// ---------- Table ----------
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cx('border-b border-line px-4 py-2.5 text-left text-xs font-medium text-faint whitespace-nowrap', className)}>{children}</th>
  );
}
export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cx('border-b border-line/70 px-4 py-3 align-middle', className)}>{children}</td>;
}

export function ColorDot({ color, className }: { color?: string | null; className?: string }) {
  return <span className={cx('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ background: color || 'var(--ph-faint)' }} />;
}
