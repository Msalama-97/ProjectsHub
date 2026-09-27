import { useState } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { api, type User } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date } from '../lib/format';
import { useForm, useSave, useUsers } from '../lib/hooks';
import { Badge, Button, Card, CardHeader, ConfirmDialog, Field, Input, Modal, PageHeader, Select, Table, Td, Th, useConfirm } from '../components/ui';
import { RowActions } from '../components/shared';

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  return (
    <div>
      <PageHeader title="Settings" subtitle="Your account and who has access." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <PasswordCard />
        </div>
        <div className="lg:col-span-2">{isAdmin ? <UsersCard /> : <MembersCard />}</div>
      </div>
    </div>
  );
}

function PasswordCard() {
  const f = useForm({ current: '', next: '', confirm: '' });
  const [err, setErr] = useState('');
  const save = useSave(() => api.post('/auth/change-password', { current: f.values.current, next: f.values.next }), 'Password changed', f.reset);
  return (
    <Card>
      <CardHeader title="Change password" />
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (f.values.next !== f.values.confirm) return setErr('Passwords do not match');
          setErr('');
          save.mutate(undefined);
        }}
      >
        <Field label="Current password">
          <Input type="password" required value={f.values.current} onChange={f.set('current')} autoComplete="current-password" />
        </Field>
        <Field label="New password" hint="At least 8 characters">
          <Input type="password" required minLength={8} value={f.values.next} onChange={f.set('next')} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password">
          <Input type="password" required value={f.values.confirm} onChange={f.set('confirm')} autoComplete="new-password" />
        </Field>
        {err && <p className="text-sm text-neg">{err}</p>}
        <Button type="submit" variant="primary" loading={save.isPending}>
          Update password
        </Button>
      </form>
    </Card>
  );
}

function MembersCard() {
  const users = useUsers();
  return (
    <Card>
      <CardHeader title="Members" subtitle="Ask an admin to add or change users." />
      <div className="divide-y divide-line">
        {users.data?.map((u) => (
          <div key={u.id} className="flex items-center justify-between py-2.5 text-sm">
            <div>
              <div className="font-medium">{u.name}</div>
              <div className="text-xs text-faint">{u.email}</div>
            </div>
            <Badge tone={u.role === 'admin' ? 'accent' : 'neutral'}>{u.role}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function UsersCard() {
  const { user: me } = useAuth();
  const users = useUsers();
  const [modal, setModal] = useState<User | 'new' | null>(null);
  const confirm = useConfirm<User>();
  const rm = useSave((id: number) => api.del(`/users/${id}`), 'User removed', confirm.close);
  return (
    <Card padded={false}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">Users</h3>
          <p className="text-[13px] text-muted">Everyone here can see and edit all projects. Admins can also manage users.</p>
        </div>
        <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setModal('new')}>
          Add user
        </Button>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Role</Th>
            <Th className="hidden sm:table-cell">Added</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {users.data?.map((u) => (
            <tr key={u.id} className="group hover:bg-subtle/60">
              <Td>
                <div className="font-medium">
                  {u.name} {u.id === me?.id && <span className="text-xs font-normal text-faint">(you)</span>}
                </div>
                <div className="text-xs text-faint">{u.email}</div>
              </Td>
              <Td>
                <Badge tone={u.role === 'admin' ? 'accent' : 'neutral'}>
                  {u.role === 'admin' && <ShieldCheck className="size-3" />}
                  {u.role === 'admin' ? 'Admin' : 'Member'}
                </Badge>
              </Td>
              <Td className="hidden text-muted sm:table-cell">{date(u.created_at)}</Td>
              <Td className="w-20">
                <RowActions onEdit={() => setModal(u)} onDelete={u.id === me?.id ? undefined : () => confirm.ask(u)} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {modal && <UserModal user={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} />}
      <ConfirmDialog
        open={!!confirm.target}
        onClose={confirm.close}
        onConfirm={() => rm.mutate(confirm.target!.id)}
        loading={rm.isPending}
        title="Remove user?"
        confirmLabel="Remove"
        text={`${confirm.target?.name} will no longer be able to sign in. Their records stay.`}
      />
    </Card>
  );
}

function UserModal({ user, onClose }: { user?: User; onClose: () => void }) {
  const f = useForm({ name: user?.name ?? '', email: user?.email ?? '', role: user?.role ?? 'member', password: '' });
  const save = useSave(
    () => {
      const v = f.values;
      if (user) return api.patch(`/users/${user.id}`, { name: v.name, role: v.role, ...(v.password ? { password: v.password } : {}) });
      return api.post('/users', v);
    },
    user ? 'User updated' : 'User added',
    onClose,
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={user ? 'Edit user' : 'Add user'}
      description={user ? undefined : 'Share the email and password with them — they can change the password in Settings.'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="user-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="user-form"
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <Field label="Name" className="col-span-2">
          <Input required autoFocus value={f.values.name} onChange={f.set('name')} />
        </Field>
        <Field label="Email" className="col-span-2">
          <Input type="email" required disabled={!!user} value={f.values.email} onChange={f.set('email')} />
        </Field>
        <Field label="Role">
          <Select value={f.values.role} onChange={f.set('role') as never}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        <Field label={user ? 'Reset password' : 'Password'} hint={user ? 'Leave empty to keep current' : 'At least 8 characters'}>
          <Input type="text" required={!user} minLength={8} value={f.values.password} onChange={f.set('password')} autoComplete="off" />
        </Field>
      </form>
    </Modal>
  );
}
