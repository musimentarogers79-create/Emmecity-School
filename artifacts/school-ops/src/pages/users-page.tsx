import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, LockKeyhole, Pencil, Plus, ShieldCheck, Trash2, UserCheck, UserX } from 'lucide-react';
import {
  getGetOperationsQueryKey,
  getListUsersQueryKey,
  type AuthUser,
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
const classAssignmentKey = (name: string, stream?: string | null) => {
  const trimmedName = name.trim();
  const trimmedStream = String(stream || '').trim();
  return trimmedStream ? `${trimmedName} ${trimmedStream}` : trimmedName;
};

export function UsersPage() {
  const client = useQueryClient();
  const session = useGetCurrentUser();
  const operations = useGetOperations();
  const users = useListUsers({ query: { enabled: session.data?.user.role === 'administrator' || session.data?.user.role === 'super_admin' || session.data?.user.permissions.includes('users_view'), queryKey: getListUsersQueryKey() } });
  const create = useCreateUser();
  const update = useUpdateUserProfileByAdmin();
  const updatePermissions = useUpdateUserPermissions();
  const remove = useDeleteUser();
  const [form, setForm] = useState<UserAccountInput>(emptyForm());
  const [selectedId, setSelectedId] = useState<string>();
  const [edit, setEdit] = useState<UserAdminProfileUpdate>({});
  const [notice, setNotice] = useState('');
  const selected = (users.data || []).find((user) => user.id === selectedId);
  const isAdmin = session.data?.user.role === 'administrator' || session.data?.user.role === 'super_admin';
  const canManage = isAdmin || session.data?.user.permissions.includes('users_manage');

  const refresh = () => {
    void client.invalidateQueries({ queryKey: getListUsersQueryKey() });
    void client.invalidateQueries({ queryKey: getGetOperationsQueryKey() });
  };
  const selectUser = (user: AuthUser) => {
    setSelectedId(user.id);
    setEdit({ name: user.name, identifier: user.identifier, email: user.email, phone: user.phone, department: user.department, role: user.role, status: user.status, permissions: user.permissions, assignedClasses: user.assignedClasses || [] });
    setNotice('');
  };
  const submitCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setNotice('');
    create.mutate({ data: form }, { onSuccess: () => { setForm(emptyForm()); refresh(); setNotice('Account created.'); }, onError: () => setNotice('The account could not be created. Check the identifier and password.') });
  };
  const submitEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setNotice('');
    update.mutate({ userId: selected.id, data: edit }, { onSuccess: () => { refresh(); setNotice('Account details saved.'); }, onError: () => setNotice('The account could not be updated.') });
  };
  const toggleStatus = (user: AuthUser) => {
    update.mutate({ userId: user.id, data: { status: user.status === 'active' ? 'inactive' : 'active' } }, { onSuccess: refresh, onError: () => setNotice('Account status could not be changed.') });
  };
  const deleteAccount = (user: AuthUser) => {
    if (!window.confirm(`Delete ${user.name}'s account? This cannot be undone.`)) return;
    remove.mutate({ userId: user.id }, { onSuccess: () => { if (selectedId === user.id) setSelectedId(undefined); refresh(); }, onError: () => setNotice('Only the Super Admin can delete accounts.') });
  };
  const savePermissions = () => {
    if (!selected) return;
    updatePermissions.mutate({ userId: selected.id, data: { permissions: edit.permissions || [], assignedClasses: edit.assignedClasses || [] } }, { onSuccess: () => { refresh(); setNotice('Permissions saved.'); }, onError: () => setNotice('Permissions could not be saved.') });
  };

  if (session.isLoading) return <AppShell><Skeleton className="h-40" /></AppShell>;
  if (!session.data || (!isAdmin && !session.data.user.permissions.includes('users_view'))) return <AppShell><ErrorState message="Users & Roles is available to authorized administrators only." /></AppShell>;
  return <AppShell>
    <PageHeader eyebrow="Administration" title="Users & Roles" description="Create accounts, control access, and keep school responsibilities tied to the right people." action={canManage ? <Button onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })} testId="button-new-user"><Plus className="size-4" /> New account</Button> : undefined} />
    {notice && <div className="mb-5 rounded-xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.06)] px-4 py-3 text-sm" role="status">{notice}</div>}
    <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <Panel className="overflow-hidden">
        <div className="border-b border-[hsl(var(--border))] px-5 py-4"><div className="flex items-center gap-3"><ShieldCheck className="size-5 text-[hsl(var(--primary))]" /><div><h2 className="font-display text-xl">School accounts</h2><p className="text-sm text-[hsl(var(--muted-foreground))]">{users.data?.length || 0} accounts in this school</p></div></div></div>
        {users.isLoading ? <div className="space-y-3 p-5"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : users.isError ? <ErrorState onRetry={refresh} /> : !users.data?.length ? <EmptyState icon={KeyRound} title="No accounts yet" description="Create the first staff or pupil-linked account." /> : <div className="divide-y divide-[hsl(var(--border))]">{users.data.map((user) => <button key={user.id} onClick={() => selectUser(user)} className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[hsl(var(--muted)/.45)] ${selectedId === user.id ? 'bg-[hsl(var(--secondary)/.7)]' : ''}`} data-testid={`button-select-user-${user.id}`}><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${user.status === 'active' ? 'bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{user.initials}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.name}</span><span className="mt-1 block truncate text-xs text-[hsl(var(--muted-foreground))]">{user.identifier} · {labelForRole(user.role)}</span></span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${user.status === 'active' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{user.status}</span></button>)}</div>}
      </Panel>
      <div className="space-y-6">
        {canManage && <Panel className="p-5"><div className="mb-4"><h2 className="font-display text-xl">Create account</h2><p className="text-sm text-[hsl(var(--muted-foreground))]">Staff use usernames. Guardian and pupil accounts can use permanent registration numbers.</p></div><form onSubmit={submitCreate} className="grid gap-3 sm:grid-cols-2"><input className={inputClass} required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input className={inputClass} required placeholder="Username or registration number" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} /><input className={inputClass} required minLength={8} type="password" placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role, userType: ['guardian', 'student'].includes(e.target.value) ? 'learner' : 'staff' })}>{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select><input className={inputClass} type="email" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><input className={inputClass} placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><input className={inputClass} placeholder="Department or responsibility area (optional)" value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /><input className={inputClass} placeholder="Linked pupil ID (optional)" value={form.studentId || ''} onChange={(e) => setForm({ ...form, studentId: e.target.value || null })} /><div className="sm:col-span-2 flex justify-end"><Button type="submit" disabled={create.isPending} testId="button-create-user">{create.isPending ? 'Creating…' : 'Create account'}</Button></div></form></Panel>}
         {selected && canManage && <Panel className="p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-display text-xl">Manage account</h2><p className="text-sm text-[hsl(var(--muted-foreground))]">{selected.name} · {labelForRole(selected.role)}</p></div><Pencil className="size-5 text-[hsl(var(--primary))]" /></div><form onSubmit={submitEdit} className="space-y-3"><input className={inputClass} required value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Full name" /><input className={inputClass} required value={edit.identifier || ''} onChange={(e) => setEdit({ ...edit, identifier: e.target.value })} placeholder="Username" /><div className="grid gap-3 sm:grid-cols-2"><input className={inputClass} type="email" value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="Email" /><input className={inputClass} value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="Phone" /><input className={inputClass} value={edit.department || ''} onChange={(e) => setEdit({ ...edit, department: e.target.value })} placeholder="Department or responsibility area" /></div><input className={inputClass} minLength={8} type="password" value={edit.newPassword || ''} onChange={(e) => setEdit({ ...edit, newPassword: e.target.value })} placeholder="New password (leave blank to keep current)" /><div className="grid gap-3 sm:grid-cols-2"><select className={inputClass} value={edit.role || selected.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })} disabled={session.data.user.role !== 'super_admin'}>{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select><select className={inputClass} value={edit.status || selected.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as 'active' | 'inactive' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div><div className="flex flex-wrap gap-2"><Button type="submit" disabled={update.isPending} testId="button-save-user">{update.isPending ? 'Saving…' : 'Save account'}</Button><Button onClick={() => toggleStatus(selected)} variant="secondary" disabled={update.isPending} testId="button-toggle-user-status">{selected.status === 'active' ? <><UserX className="size-4" /> Deactivate</> : <><UserCheck className="size-4" /> Activate</>}</Button><Button onClick={() => deleteAccount(selected)} variant="danger" disabled={remove.isPending || session.data.user.role !== 'super_admin'} testId="button-delete-user"><Trash2 className="size-4" /> Delete</Button></div></form><div className="mt-6 border-t border-[hsl(var(--border))] pt-5"><div className="mb-3 flex items-center gap-2"><LockKeyhole className="size-4 text-[hsl(var(--primary))]" /><h3 className="text-sm font-semibold">Permissions & responsibilities</h3></div><div className="grid gap-2 sm:grid-cols-2">{permissions.map((permission) => <label key={permission.value} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={(edit.permissions || []).includes(permission.value)} onChange={() => setEdit({ ...edit, permissions: (edit.permissions || []).includes(permission.value) ? (edit.permissions || []).filter((item) => item !== permission.value) : [...(edit.permissions || []), permission.value] })} />{permission.label}</label>)}</div><p className="mt-5 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Assigned classes</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{(operations.data?.modules.classes || []).map((item) => { const key = classAssignmentKey(String(item.name), item.stream ? String(item.stream) : ''); return <label key={item.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={(edit.assignedClasses || []).includes(key)} onChange={() => setEdit({ ...edit, assignedClasses: (edit.assignedClasses || []).includes(key) ? (edit.assignedClasses || []).filter((value) => value !== key) : [...(edit.assignedClasses || []), key] })} />{item.name}{item.stream ? ` · ${item.stream}` : ''}</label>; })}</div><Button onClick={savePermissions} disabled={updatePermissions.isPending} className="mt-4" testId="button-save-permissions">{updatePermissions.isPending ? 'Saving…' : 'Save permissions & assignments'}</Button></div></Panel>}
      </div>
    </div>
  </AppShell>;
}