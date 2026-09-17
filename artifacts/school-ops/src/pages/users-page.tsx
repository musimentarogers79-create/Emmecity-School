import { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, LockKeyhole, Pencil, Plus, Save, ShieldCheck, Trash2, UserCheck, UserX } from 'lucide-react';
import {
  getListUsersQueryKey,
  type PermissionKey,
  type Role,
  type UserAccountInput,
  type UserAdminProfileUpdate,
  useCreateUser,
  useDeleteUser,
  useGetCurrentUser,
  useGetOperations,
  useListUsers,
  useUpdateUserPermissions,
  useUpdateUserProfileByAdmin,
} from '@workspace/api-client-react';
import { AppShell, Button, EmptyState, ErrorState, PageHeader, Panel, Skeleton } from '@/components/school-shell';
import { useLocation, useRoute } from 'wouter';

const roles: { value: Role; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'administrator', label: 'Administrator' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'librarian', label: 'Librarian' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'staff', label: 'Other staff' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'student', label: 'Pupil' },
];
const permissions: { value: PermissionKey; label: string }[] = [
  { value: 'users_view', label: 'View users' },
  { value: 'users_manage', label: 'Manage users' },
  { value: 'subjects_view', label: 'View subjects' },
  { value: 'subjects_manage', label: 'Manage subjects' },
  { value: 'subjects_delete', label: 'Delete subjects' },
  { value: 'finance_view', label: 'View finance' },
  { value: 'expenses_view', label: 'View expenses' },
  { value: 'expense_approve', label: 'Approve expenses' },
  { value: 'expense_delete', label: 'Delete expenses' },
  { value: 'transactions_view', label: 'View transactions' },
  { value: 'transactions_print', label: 'Print transactions' },
];

const inputClass = 'focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm outline-none';
const emptyForm = (): UserAccountInput => ({ name: '', identifier: '', password: '', role: 'staff', userType: 'staff', email: '', phone: '', permissions: [] });
const labelForRole = (role: Role) => roles.find((item) => item.value === role)?.label || role;
const classDisplayKey = (name: string, stream?: string | null) => {
  const trimmedName = name.trim();
  const trimmedStream = String(stream || '').trim();
  return trimmedStream ? `${trimmedName} ${trimmedStream}` : trimmedName;
};
const classAssignmentValue = (name: string, stream?: string | null) => {
  const trimmedName = name.trim();
  const trimmedStream = String(stream || '').trim();
  return trimmedStream ? `${trimmedName}::${trimmedStream}` : trimmedName;
};

export function UsersPage() {
  const [, navigate] = useLocation();
  const session = useGetCurrentUser();
  const canView = session.data?.user.role === 'administrator'
    || session.data?.user.role === 'super_admin'
    || session.data?.user.permissions.includes('users_view');
  const canManage = session.data?.user.role === 'administrator'
    || session.data?.user.role === 'super_admin'
    || session.data?.user.permissions.includes('users_manage');
  const users = useListUsers({ query: { enabled: Boolean(canView), queryKey: getListUsersQueryKey() } });

  if (session.isLoading) return <AppShell><Skeleton className="h-40" /></AppShell>;
  if (!session.data || !canView) return <AppShell><ErrorState message="Users & Roles is available to authorized administrators only." /></AppShell>;

  return <AppShell>
    <PageHeader
      eyebrow="Administration"
      title="Users & Roles"
      description="Create accounts, control access, and keep school responsibilities tied to the right people."
      action={canManage ? <Button onClick={() => navigate('/users/new')} testId="button-new-user"><Plus className="size-4" /> New account</Button> : undefined}
    />
    <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <Panel className="overflow-hidden">
        <div className="border-b border-[hsl(var(--border))] px-5 py-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-[hsl(var(--primary))]" />
            <div>
              <h2 className="font-display text-xl">School accounts</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{users.data?.length || 0} accounts in this school</p>
            </div>
          </div>
        </div>
        {users.isLoading ? <div className="space-y-3 p-5"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
          : users.isError ? <ErrorState onRetry={() => void users.refetch()} />
            : !users.data?.length ? <EmptyState icon={KeyRound} title="No accounts yet" description={canManage ? 'Create the first staff or pupil-linked account.' : 'No accounts are available to your role.'} />
              : <div className="divide-y divide-[hsl(var(--border))]">{users.data.map((user) => <button key={user.id} onClick={() => navigate(`/users/${user.id}`)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[hsl(var(--muted)/.45)]" data-testid={`button-select-user-${user.id}`}>
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${user.status === 'active' ? 'bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{user.initials}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.name}</span><span className="mt-1 block truncate text-xs text-[hsl(var(--muted-foreground))]">{user.identifier} · {labelForRole(user.role)}</span></span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${user.status === 'active' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{user.status}</span>
                <Pencil className="size-4 text-[hsl(var(--muted-foreground))]" />
              </button>)}</div>}
      </Panel>
      <Panel className="p-6">
        <p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.18em] text-[hsl(var(--primary))]">Account workspace</p>
        <h2 className="mt-2 font-display text-3xl">Manage each account on its own page</h2>
        <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Open an account to edit its identity, status, password, permissions, and assigned classes without losing your place in the account directory.</p>
        {canManage && <Button className="mt-6" onClick={() => navigate('/users/new')} testId="button-open-create-account"><Plus className="size-4" /> Create an account</Button>}
      </Panel>
    </div>
  </AppShell>;
}

export function UserAccountPage() {
  const [, navigate] = useLocation();
  const [isNewRoute] = useRoute('/users/new');
  const [, routeParams] = useRoute('/users/:userId');
  const userId = isNewRoute ? undefined : routeParams?.userId;
  const session = useGetCurrentUser();
  const users = useListUsers({ query: { enabled: Boolean(userId), queryKey: getListUsersQueryKey() } });
  const operations = useGetOperations();
  const create = useCreateUser();
  const update = useUpdateUserProfileByAdmin();
  const updatePermissions = useUpdateUserPermissions();
  const remove = useDeleteUser();
  const [form, setForm] = useState<UserAccountInput>(emptyForm());
  const [edit, setEdit] = useState<UserAdminProfileUpdate>({});
  const [notice, setNotice] = useState('');
  const account = (users.data || []).find((user) => user.id === userId);
  const isAdmin = session.data?.user.role === 'administrator' || session.data?.user.role === 'super_admin';
  const canManage = isAdmin || session.data?.user.permissions.includes('users_manage');
  const isTeacherAccount = (edit.role || account?.role) === 'teacher';

  useEffect(() => {
    if (!account) {
      if (userId) setEdit({});
      return;
    }
    setEdit({ name: account.name, identifier: account.identifier, email: account.email, phone: account.phone, department: account.department, role: account.role, status: account.status, permissions: account.permissions, assignedClasses: account.assignedClasses || [] });
  }, [account, userId]);

  const submitCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setNotice('');
    create.mutate({ data: form }, { onSuccess: () => { void users.refetch(); navigate('/users'); }, onError: () => setNotice('The account could not be created. Check the identifier and password.') });
  };

  const submitEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!account) return;
    setNotice('');
    update.mutate({ userId: account.id, data: edit }, { onSuccess: () => { void users.refetch(); setNotice('Account details saved.'); }, onError: () => setNotice('The account could not be updated.') });
  };

  const toggleStatus = () => {
    if (!account) return;
    update.mutate({ userId: account.id, data: { status: account.status === 'active' ? 'inactive' : 'active' } }, { onSuccess: () => void users.refetch(), onError: () => setNotice('Account status could not be changed.') });
  };

  const deleteAccount = () => {
    if (!account || !window.confirm(`Delete ${account.name}'s account? This cannot be undone.`)) return;
    remove.mutate({ userId: account.id }, { onSuccess: () => navigate('/users'), onError: () => setNotice('Only the Super Admin can delete accounts.') });
  };

  const savePermissions = () => {
    if (!account) return;
    const selectedClasses = (operations.data?.modules.classes || [])
      .filter((item) => (edit.assignedClasses || []).includes(classDisplayKey(String(item.name), item.stream ? String(item.stream) : '')))
      .map((item) => classAssignmentValue(String(item.name), item.stream ? String(item.stream) : ''));
    updatePermissions.mutate({ userId: account.id, data: { permissions: edit.permissions || [], assignedClasses: isTeacherAccount ? selectedClasses : [] } }, { onSuccess: () => { void users.refetch(); setNotice('Permissions and assignments saved.'); }, onError: () => setNotice('Permissions could not be saved.') });
  };

  if (session.isLoading || (userId && users.isLoading)) return <AppShell><Skeleton className="h-64" /></AppShell>;
  if (!session.data || !canManage) return <AppShell><ErrorState message="Only authorized administrators can manage accounts." /></AppShell>;
  if (userId && !account) return <AppShell><ErrorState message="That account could not be found." onRetry={() => void users.refetch()} /></AppShell>;

  if (isNewRoute) return <AppShell>
    <PageHeader eyebrow="Administration · New account" title="Create account" description="Set up a staff, teacher, pupil, or guardian account with the access it needs." action={<Button variant="secondary" onClick={() => navigate('/users')} testId="button-back-users"><ArrowLeft className="size-4" /> Back to users</Button>} />
    {notice && <div className="mb-5 rounded-xl border border-[hsl(var(--destructive)/.2)] bg-[hsl(var(--destructive)/.06)] px-4 py-3 text-sm" role="alert">{notice}</div>}
    <Panel className="p-6">
      <div className="mb-6 flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><Plus className="size-5" /></span><div><h2 className="font-display text-2xl">Account details</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Staff use usernames. Guardian and pupil accounts can use permanent registration numbers.</p></div></div>
      <form onSubmit={submitCreate} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold">Full name<input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" data-testid="input-account-name" /></label>
          <label className="space-y-2 text-sm font-semibold">Username or registration number<input className={inputClass} required value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} placeholder="Unique identifier" data-testid="input-account-identifier" /></label>
          <label className="space-y-2 text-sm font-semibold">Temporary password<input className={inputClass} required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" data-testid="input-account-password" /></label>
          <label className="space-y-2 text-sm font-semibold">Account role<select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role, userType: ['guardian', 'student'].includes(e.target.value) ? 'learner' : 'staff' })}>{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
        </div>
        <div className="border-t border-[hsl(var(--border))] pt-5"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[hsl(var(--primary))]">Contact and linking</p><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="space-y-2 text-sm font-semibold">Email <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span><input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" /></label><label className="space-y-2 text-sm font-semibold">Phone <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span><input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+256 ..." /></label><label className="space-y-2 text-sm font-semibold">Department or responsibility <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span><input className={inputClass} value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="For example, Finance" /></label><label className="space-y-2 text-sm font-semibold">Linked pupil ID <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span><input className={inputClass} value={form.studentId || ''} onChange={(e) => setForm({ ...form, studentId: e.target.value || null })} placeholder="Pupil record ID" /></label></div></div>
        <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="secondary" onClick={() => navigate('/users')}>Cancel</Button><Button type="submit" disabled={create.isPending} testId="button-create-user">{create.isPending ? 'Creating…' : 'Create account'}<Save className="size-4" /></Button></div>
      </form>
    </Panel>
  </AppShell>;

  return <AppShell>
    <PageHeader eyebrow="Administration · Account" title={account?.name || 'Manage account'} description="Update identity details, access, status, password, and class responsibilities from this account workspace." action={<Button variant="secondary" onClick={() => navigate('/users')} testId="button-back-users"><ArrowLeft className="size-4" /> Back to users</Button>} />
    {notice && <div className="mb-5 rounded-xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.06)] px-4 py-3 text-sm" role="status">{notice}</div>}
    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <Panel className="p-6">
        <div className="mb-6 flex items-start justify-between gap-4"><div><p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.18em] text-[hsl(var(--primary))]">Account profile</p><h2 className="mt-2 font-display text-2xl">{account?.name}</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{account ? `${account.identifier} · ${labelForRole(account.role)}` : ''}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${account?.status === 'active' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{account?.status}</span></div>
        <form onSubmit={submitEdit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2"><label className="space-y-2 text-sm font-semibold">Full name<input className={inputClass} required value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label><label className="space-y-2 text-sm font-semibold">Username or registration number<input className={inputClass} required value={edit.identifier || ''} onChange={(e) => setEdit({ ...edit, identifier: e.target.value })} /></label><label className="space-y-2 text-sm font-semibold">Email<input className={inputClass} type="email" value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></label><label className="space-y-2 text-sm font-semibold">Phone<input className={inputClass} value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></label><label className="space-y-2 text-sm font-semibold">Department or responsibility<input className={inputClass} value={edit.department || ''} onChange={(e) => setEdit({ ...edit, department: e.target.value })} /></label><label className="space-y-2 text-sm font-semibold">New password <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span><input className={inputClass} minLength={8} type="password" value={edit.newPassword || ''} onChange={(e) => setEdit({ ...edit, newPassword: e.target.value })} placeholder="Leave blank to keep current" /></label></div>
          <div className="grid gap-4 border-t border-[hsl(var(--border))] pt-5 md:grid-cols-2"><label className="space-y-2 text-sm font-semibold">Role<select className={inputClass} value={edit.role || account?.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })} disabled={session.data.user.role !== 'super_admin'}>{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label><label className="space-y-2 text-sm font-semibold">Status<select className={inputClass} value={edit.status || account?.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as 'active' | 'inactive' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>
          <div className="flex flex-wrap gap-3"><Button type="submit" disabled={update.isPending} testId="button-save-user">{update.isPending ? 'Saving…' : 'Save account'}<Save className="size-4" /></Button><Button type="button" onClick={toggleStatus} variant="secondary" disabled={update.isPending} testId="button-toggle-user-status">{account?.status === 'active' ? <><UserX className="size-4" /> Deactivate</> : <><UserCheck className="size-4" /> Activate</>}</Button><Button type="button" onClick={deleteAccount} variant="danger" disabled={remove.isPending || session.data.user.role !== 'super_admin'} testId="button-delete-user"><Trash2 className="size-4" /> Delete</Button></div>
        </form>
      </Panel>
        <Panel className="p-6"><div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><LockKeyhole className="size-5" /></span><div><h2 className="font-display text-2xl">Permissions and assignments</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Control what this account can see and which classes a teacher can access.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{permissions.map((permission) => <label key={permission.value} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={(edit.permissions || []).includes(permission.value)} onChange={() => setEdit({ ...edit, permissions: (edit.permissions || []).includes(permission.value) ? (edit.permissions || []).filter((item) => item !== permission.value) : [...(edit.permissions || []), permission.value] })} />{permission.label}</label>)}</div><div className="mt-6 border-t border-[hsl(var(--border))] pt-5"><p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Assigned classes</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{isTeacherAccount ? 'Select every class and stream this teacher is responsible for.' : 'Classes are shown here and become selectable when this account has the Teacher role.'}</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{(operations.data?.modules.classes || []).map((item) => { const key = classDisplayKey(String(item.name), item.stream ? String(item.stream) : ''); return <label key={item.id} className={`flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs ${!isTeacherAccount ? 'opacity-60' : ''}`}><input type="checkbox" disabled={!isTeacherAccount} checked={(edit.assignedClasses || []).includes(key)} onChange={() => setEdit({ ...edit, assignedClasses: (edit.assignedClasses || []).includes(key) ? (edit.assignedClasses || []).filter((value) => value !== key) : [...(edit.assignedClasses || []), key] })} data-testid={`checkbox-assigned-class-${item.id}`} />{item.name}{item.stream ? ` · ${item.stream}` : ''}</label>; })}</div>{!operations.data?.modules.classes?.length && <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Create a class first, then return here to assign it.</p>}</div><Button onClick={savePermissions} disabled={updatePermissions.isPending} className="mt-5" testId="button-save-permissions">{updatePermissions.isPending ? 'Saving…' : 'Save permissions & assignments'}<Save className="size-4" /></Button></Panel>
    </div>
  </AppShell>;
}