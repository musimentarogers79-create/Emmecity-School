import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { type ExpenseInput, type SalaryPaymentInput, type UserAccountInput, useCreateExpense, useCreateSalaryPayment, useCreateUser, useGetCurrentUser, useGetOperations, getGetOperationsQueryKey } from '@workspace/api-client-react';
import { Archive, ArrowRight, BarChart3, Bell, BookOpen, BusFront, CalendarDays, ClipboardList, FileText, HeartPulse, Library, Package, Plus, Receipt, RefreshCcw, ShieldAlert, Users, WalletCards } from 'lucide-react';
import { AppShell, Button, EmptyState, ErrorState, PageHeader, Panel, Skeleton } from '@/components/school-shell';

type ViewKey = 'people' | 'classes' | 'assignments' | 'staff' | 'parents' | 'expenses' | 'salaries' | 'discipline' | 'medical' | 'library' | 'transport' | 'inventory' | 'events' | 'documents' | 'reports' | 'notifications';
type Row = Record<string, string | number | boolean>;

const views: { key: ViewKey; label: string; icon: typeof ClipboardList }[] = [
  { key: 'people', label: 'People & accounts', icon: Users }, { key: 'classes', label: 'Classes', icon: Users }, { key: 'assignments', label: 'Assignments', icon: ClipboardList },
  { key: 'staff', label: 'Staff', icon: Users }, { key: 'parents', label: 'Parents', icon: Users }, { key: 'expenses', label: 'Expenses', icon: Receipt },
  { key: 'salaries', label: 'Salaries', icon: WalletCards }, { key: 'discipline', label: 'Discipline', icon: ShieldAlert }, { key: 'medical', label: 'Medical', icon: HeartPulse },
  { key: 'library', label: 'Library', icon: Library }, { key: 'transport', label: 'Transport', icon: BusFront }, { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'events', label: 'Events', icon: CalendarDays }, { key: 'documents', label: 'Documents', icon: FileText }, { key: 'reports', label: 'Reports', icon: BarChart3 }, { key: 'notifications', label: 'Notifications', icon: Bell },
];

const roleViews: Record<string, ViewKey[]> = {
  administrator: views.map((item) => item.key),
  super_admin: views.map((item) => item.key),
  teacher: ['classes', 'assignments', 'discipline', 'medical', 'events', 'documents', 'notifications'],
  accountant: ['expenses', 'salaries', 'reports', 'documents', 'notifications'],
  guardian: ['assignments', 'discipline', 'medical', 'library', 'transport', 'events', 'notifications'],
  student: ['assignments', 'library', 'transport', 'events', 'notifications'],
  staff: ['events', 'documents', 'notifications'],
};

const pretty = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
const compactValue = (value: string | number | boolean | undefined) => value === undefined ? '—' : typeof value === 'boolean' ? (value ? 'Read' : 'Unread') : String(value);
const money = (value: string | number | boolean | undefined, currency: string) => typeof value === 'number' ? new Intl.NumberFormat('en-UG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) : compactValue(value);
const inputClass = 'focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm outline-none';

function OperationsSkeleton() {
  return <div className="grid gap-6 lg:grid-cols-[250px_1fr]"><Panel className="p-4"><Skeleton className="h-5 w-32" /><div className="mt-5 space-y-3">{[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-10 w-full" />)}</div></Panel><Panel className="p-6"><Skeleton className="h-8 w-52" /><Skeleton className="mt-8 h-48 w-full" /></Panel></div>;
}

function CreateAccountPanel() {
  const client = useQueryClient();
  const create = useCreateUser();
  const [form, setForm] = useState({ name: '', identifier: '', password: '', role: 'teacher', studentId: '' });
  const update = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const data: UserAccountInput = { name: form.name, identifier: form.identifier, password: form.password, role: form.role as UserAccountInput['role'], userType: form.role === 'student' || form.role === 'guardian' ? 'learner' : 'staff', studentId: form.role === 'guardian' || form.role === 'student' ? form.studentId : null };
    create.mutate({ data }, { onSuccess: () => { setForm({ name: '', identifier: '', password: '', role: 'teacher', studentId: '' }); client.invalidateQueries({ queryKey: getGetOperationsQueryKey() }); } });
  };
  return <Panel className="border-dashed p-5" testId="panel-create-account"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Plus className="size-4" /></span><div><h2 className="font-display text-xl">Create a school account</h2><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Only an administrator can issue usernames, pupil registration-number logins, and passwords.</p></div></div><form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-2"><input required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Full name" className={inputClass} data-testid="input-account-name" /><input required value={form.identifier} onChange={(event) => update('identifier', event.target.value)} placeholder={form.role === 'student' ? 'Permanent registration number' : 'Username'} className={inputClass} data-testid="input-account-identifier" /><select value={form.role} onChange={(event) => update('role', event.target.value)} className={inputClass} data-testid="select-account-role">{['teacher', 'accountant', 'staff', 'guardian', 'student'].map((role) => <option key={role} value={role}>{role === 'student' ? 'Pupil' : role[0].toUpperCase() + role.slice(1)}</option>)}</select><input required minLength={8} type="password" value={form.password} onChange={(event) => update('password', event.target.value)} placeholder="Temporary password (8+ characters)" className={inputClass} data-testid="input-account-password" />{(form.role === 'guardian' || form.role === 'student') && <input required value={form.studentId} onChange={(event) => update('studentId', event.target.value)} placeholder="Linked pupil ID or registration number" className={`${inputClass} md:col-span-2`} data-testid="input-account-student-id" />}<div className="md:col-span-2 flex items-center justify-between gap-3">{create.isError && <p className="text-xs text-[hsl(var(--destructive))]">Account could not be created. Check the identifier and linked pupil.</p>}<Button type="submit" disabled={create.isPending} testId="button-create-account">{create.isPending ? 'Creating…' : 'Create account'}</Button></div></form></Panel>;
}

function ExpenseComposer() {
  const client = useQueryClient();
  const create = useCreateExpense();
  const [form, setForm] = useState<ExpenseInput>({ category: '', description: '', amount: 0, date: new Date().toISOString().slice(0, 10), reference: '' });
  const update = (key: keyof ExpenseInput, value: string) => setForm((old) => ({ ...old, [key]: key === 'amount' ? Number(value) : value }));
  const submit = (event: React.FormEvent) => { event.preventDefault(); create.mutate({ data: form }, { onSuccess: () => { setForm({ category: '', description: '', amount: 0, date: new Date().toISOString().slice(0, 10), reference: '' }); client.invalidateQueries({ queryKey: getGetOperationsQueryKey() }); } }); };
  return <Panel className="border-dashed p-5" testId="panel-create-expense"><h2 className="font-display text-xl">Record an expense</h2><form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-4"><input required value={form.category} onChange={(event) => update('category', event.target.value)} placeholder="Category" className={inputClass} data-testid="input-expense-category" /><input required value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Description" className={inputClass} data-testid="input-expense-description" /><input required min={1} type="number" value={form.amount || ''} onChange={(event) => update('amount', event.target.value)} placeholder="Amount" className={inputClass} data-testid="input-expense-amount" /><input required value={form.reference} onChange={(event) => update('reference', event.target.value)} placeholder="Reference" className={inputClass} data-testid="input-expense-reference" /><input required type="date" value={form.date} onChange={(event) => update('date', event.target.value)} className={inputClass} data-testid="input-expense-date" /><div className="md:col-span-3 flex justify-end"><Button type="submit" disabled={create.isPending} testId="button-create-expense">{create.isPending ? 'Saving…' : 'Save expense'}</Button></div></form></Panel>;
}

function SalaryComposer() {
  const client = useQueryClient();
  const create = useCreateSalaryPayment();
  const [form, setForm] = useState<SalaryPaymentInput>({ staffId: '', period: '', amount: 0, method: 'Bank transfer', reference: '' });
  const update = (key: keyof SalaryPaymentInput, value: string) => setForm((old) => ({ ...old, [key]: key === 'amount' ? Number(value) : value }));
  const submit = (event: React.FormEvent) => { event.preventDefault(); create.mutate({ data: form }, { onSuccess: () => { setForm({ staffId: '', period: '', amount: 0, method: 'Bank transfer', reference: '' }); client.invalidateQueries({ queryKey: getGetOperationsQueryKey() }); } }); };
  return <Panel className="border-dashed p-5" testId="panel-create-salary"><h2 className="font-display text-xl">Record a salary payment</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Use the staff account ID shown after an account is created.</p><form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-5"><input required value={form.staffId} onChange={(event) => update('staffId', event.target.value)} placeholder="Staff account ID" className={inputClass} data-testid="input-salary-staff-id" /><input required value={form.period} onChange={(event) => update('period', event.target.value)} placeholder="Period e.g. Sep 2026" className={inputClass} data-testid="input-salary-period" /><input required min={1} type="number" value={form.amount || ''} onChange={(event) => update('amount', event.target.value)} placeholder="Amount" className={inputClass} data-testid="input-salary-amount" /><select value={form.method} onChange={(event) => update('method', event.target.value)} className={inputClass} data-testid="select-salary-method"><option>Bank transfer</option><option>Mobile money</option><option>Cash</option></select><input required value={form.reference} onChange={(event) => update('reference', event.target.value)} placeholder="Reference" className={inputClass} data-testid="input-salary-reference" /><div className="md:col-span-5 flex justify-end"><Button type="submit" disabled={create.isPending} testId="button-create-salary">{create.isPending ? 'Saving…' : 'Save salary payment'}</Button></div></form></Panel>;
}

function OperationsRows({ view, rows, currency }: { view: ViewKey; rows: Row[]; currency: string }) {
  if (!rows.length) return <EmptyState icon={Archive} title={`No ${view} to show`} description="This record is empty. Add the first entry when your school is ready." />;
  const preferredColumns: Record<ViewKey, string[]> = {
    people: ['name', 'role', 'phone', 'status', 'children'], classes: ['name', 'teacherName', 'pupilCount', 'room'], assignments: ['title', 'subject', 'className', 'dueDate', 'status'],
    staff: ['name', 'role', 'phone', 'status'], parents: ['name', 'phone', 'children'], expenses: ['category', 'description', 'amount', 'date', 'status'], salaries: ['staffName', 'period', 'amount', 'paymentDate', 'method', 'status'],
    discipline: ['studentName', 'className', 'incident', 'level', 'date'], medical: ['studentName', 'className', 'condition', 'notes', 'lastUpdated'], library: ['title', 'author', 'copiesAvailable', 'status'],
    transport: ['route', 'driver', 'vehicle', 'students', 'status'], inventory: ['item', 'category', 'quantity', 'reorderLevel', 'status'], events: ['title', 'date', 'type', 'location', 'status'],
    documents: ['name', 'type', 'updatedAt', 'visibility'], reports: ['title', 'description', 'period', 'status'], notifications: ['title', 'body', 'date', 'read'],
  };
  const columns = preferredColumns[view].filter((column) => rows.some((row) => row[column] !== undefined));
  return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)]"><tr>{columns.map((column) => <th key={column} className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{pretty(column)}</th>)}{view === 'classes' && <th className="px-5 py-3" />}</tr></thead><tbody className="divide-y divide-[hsl(var(--border))]">{rows.map((row, index) => <tr key={String(row.id || index)} className="transition-colors hover:bg-[hsl(var(--muted)/.35)]" data-testid={`row-operation-${view}-${row.id || index}`}>{columns.map((column) => <td key={column} className={`max-w-[260px] px-5 py-4 text-sm ${column === 'status' ? 'font-semibold' : ''} ${column === 'description' || column === 'notes' || column === 'body' ? 'text-[hsl(var(--muted-foreground))]' : ''}`}>{column === 'amount' ? money(row[column], currency) : (column === 'status' && typeof row[column] === 'string' ? String(row[column]) : compactValue(row[column]))}</td>)}{view === 'classes' && <td className="px-5 py-4"><span className="flex items-center gap-3 whitespace-nowrap"><Link href={`/attendance?className=${encodeURIComponent(String(row.name))}`} className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline">Attendance</Link><Link href="/operations?view=assignments" className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline">Assignments</Link></span></td>}</tr>)}</tbody></table></div>;
}

export function OperationsPage() {
  const [location] = useLocation();
  const { data: session } = useGetCurrentUser();
  const query = useGetOperations();
  const role = session?.user.role || query.data?.role || 'staff';
  const visibleViews = views.filter((item) => (roleViews[role] || roleViews.staff).includes(item.key));
  const requested = new URLSearchParams(location.split('?')[1] || '').get('view') as ViewKey | null;
  const view = visibleViews.some((item) => item.key === requested) ? requested as ViewKey : visibleViews[0]?.key || 'events';
  const selected = views.find((item) => item.key === view) || views[0];
  const rows = useMemo(() => {
    const moduleRows = view === 'people' ? [...(query.data?.modules?.staff || []), ...(query.data?.modules?.parents || [])] : query.data?.modules?.[view];
    return (moduleRows || []) as unknown as Row[];
  }, [query.data, view]);
  const isAdmin = role === 'administrator' || role === 'super_admin';
  const isFinance = isAdmin || role === 'accountant';
  const availableActions = query.data?.actions || [];
  return <AppShell><PageHeader eyebrow={`${role.replace('_', ' ')} · Operations`} title="Operations hub" description="Work only with the records and actions available to your role." action={<Button variant="secondary" onClick={() => query.refetch()} testId="button-refresh-operations"><RefreshCcw className="size-4" /> Refresh</Button>} />{query.isError ? <Panel><ErrorState onRetry={() => query.refetch()} /></Panel> : query.isLoading ? <OperationsSkeleton /> : <div className="space-y-6">
    {availableActions.length > 0 && <div className="flex flex-wrap gap-2">{availableActions.slice(0, 3).map((action) => <Link href={action.href} key={action.id} className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2 text-xs font-semibold text-[hsl(var(--primary))]" data-testid={`link-operations-action-${action.id}`}>{action.label}<ArrowRight className="size-3.5" /></Link>)}</div>}
    <div className="grid gap-6 lg:grid-cols-[250px_1fr]"><Panel className="h-fit p-2" testId="panel-operations-switcher"><p className="px-3 pb-2 pt-2 font-mono-ui text-[10px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Your work areas</p>{visibleViews.map(({ key, label, icon: Icon }) => { const active = key === view; const count = key === 'people' ? (query.data?.modules?.staff.length || 0) + (query.data?.modules?.parents.length || 0) : (query.data?.modules?.[key] || []).length; return <Link href={`/operations?view=${key}`} key={key} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? 'bg-[hsl(var(--secondary))] font-semibold text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`} data-testid={`link-operation-view-${key}`}><Icon className="size-[17px]" /><span className="flex-1">{label}</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground)/.7)]">{count}</span></Link>; })}</Panel><div className="min-w-0 space-y-6"><Panel className="overflow-hidden" testId={`panel-operation-view-${view}`}><div className="flex flex-col justify-between gap-3 border-b border-[hsl(var(--border))] p-5 sm:flex-row sm:items-center"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">{query.data?.currencyCode || 'UGX'}</p><h2 className="mt-1 font-display text-2xl">{selected.label}</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{rows.length ? `${rows.length} record${rows.length === 1 ? '' : 's'} available to you` : 'No records have been created yet'}</p></div>{isFinance && view === 'expenses' && <Link href="/finance" className="text-xs font-semibold text-[hsl(var(--primary))]">Open finance <ArrowRight className="ml-1 inline size-3.5" /></Link>}</div><OperationsRows view={view} rows={rows} currency={query.data?.currencyCode || 'UGX'} /></Panel>
      {isAdmin && view === 'people' && <CreateAccountPanel />}
      {isFinance && view === 'expenses' && <ExpenseComposer />}
      {isFinance && view === 'salaries' && <SalaryComposer />}
    </div></div>
  </div>}</AppShell>;
}