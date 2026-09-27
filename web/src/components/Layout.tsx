import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { cx } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/finance', label: 'Finance', icon: Wallet },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
];

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('ph-theme', dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-lg bg-ink text-bg">
        <svg viewBox="0 0 32 32" className="size-5">
          <path d="M9 22V10h7a4 4 0 0 1 0 8h-7" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="22.5" cy="21.5" r="2.6" fill="#a78bfa" />
        </svg>
      </div>
      <span className="text-[15px] font-semibold tracking-tight">ProjectHub</span>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const theme = useTheme();
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-6">
        <Logo />
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:bg-surface/60 hover:text-ink',
              )
            }
          >
            <Icon className="size-4" strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-line px-3 py-3">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:bg-surface/60 hover:text-ink',
            )
          }
        >
          <Settings className="size-4" />
          Settings
        </NavLink>
        <button
          onClick={theme.toggle}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface/60 hover:text-ink"
        >
          {theme.dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme.dark ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
      <div className="flex items-center gap-3 border-t border-line px-5 py-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {user?.name
            .split(' ')
            .map((s) => s[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{user?.name}</div>
          <div className="truncate text-xs text-faint">{user?.email}</div>
        </div>
        <button onClick={logout} title="Sign out" className="rounded-md p-1.5 text-faint hover:bg-surface hover:text-ink">
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => window.scrollTo(0, 0), [loc.pathname]);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-line bg-bg lg:block">
        <Sidebar />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted hover:bg-subtle">
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="animate-in absolute inset-y-0 left-0 w-64 border-r border-line bg-bg">
            <button onClick={() => setOpen(false)} className="absolute top-5 right-3 rounded-lg p-1.5 text-muted hover:bg-subtle">
              <X className="size-4" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="lg:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
