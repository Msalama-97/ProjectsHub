import { useState, type FormEvent } from 'react';
import { Button, Field, Input } from '../components/ui';
import { Logo } from '../components/Layout';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between p-8 sm:p-12">
        <Logo />
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted">Sign in to see your projects, balances and team.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email">
              <Input type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {error && <div className="rounded-lg bg-neg-soft px-3 py-2 text-sm text-neg">{error}</div>}
            <Button variant="primary" type="submit" className="w-full" loading={busy}>
              Sign in
            </Button>
          </form>
        </div>
        <p className="text-xs text-faint">Projects · Finance · Team — in one place.</p>
      </div>
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 opacity-60" style={{ background: 'radial-gradient(circle at 30% 20%, #5b4bd6 0, transparent 45%), radial-gradient(circle at 80% 80%, #0f8a5f 0, transparent 40%)' }} />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <div className="max-w-md space-y-3">
            {[
              ['Website Revamp', '$38,420', '+ $12,000 this month'],
              ['Mobile App', '$91,300', '6.2 months runway'],
              ['Data Platform', '$14,050', '2 subscriptions due'],
            ].map(([n, v, s]) => (
              <div key={n} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <div>
                  <div className="text-sm font-medium">{n}</div>
                  <div className="text-xs text-white/50">{s}</div>
                </div>
                <div className="text-sm font-semibold tabular">{v}</div>
              </div>
            ))}
            <p className="pt-6 text-lg font-medium leading-snug text-white/90">
              Know exactly how much every project has left to spend.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
