import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { type ExpenseInput, type PermissionKey, type SalaryPaymentInput, type UserAccountInput, useApproveExpense, useCreateExpense, useCreateSalaryPayment, useCreateUser, useDeleteExpense, useGetCurrentUser, useGetOperations, getGetOperationsQueryKey, useListSalaryStaff, useListSalaries, useListUsers, useUpdateUserPermissions, getListUsersQueryKey, getListSalaryStaffQueryKey, getListSalariesQueryKey } from '@workspace/api-client-react';
import { Archive, ArrowRight, BarChart3, Bell, BookOpen, BusFront, CalendarDays, ClipboardList, FileText, HeartPulse, Library, Package, Plus, Receipt, RefreshCcw, ShieldAlert, Users, WalletCards } from 'lucide-react';
import { AppShell, Button, EmptyState, ErrorState, PageHeader, Panel, Skeleton } from '@/components/school-shell';
import { trackEvent } from '@/lib/analytics';

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
const money = (value: string | number | boolean | undefined, currency = 'UGX') => typeof value === 'number' ? new Intl.NumberFormat('en-UG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) : compactValue(value);
const inputClass = 'focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm outline-none';

function OperationsSkeleton() {
  return <div className="grid gap-6 lg:grid-cols-[250px_1fr]"><Panel className="p-4"><Skeleton className="h-5 w-32" /><div className="mt-5 space-y-3">{[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-10 w-full" />)}</div></Panel><Panel className="p-6"><Skeleton className="h-8 w-52" /><Skeleton className="mt-8 h-48 w-full" /></Panel></div>;
}

function CreateAccountPanel() {
  const client = useQueryClient();
  const create = useCreateUser();
  const operations = useGetOperations();
  const [form, setForm] = useState({ name: '', identifier: '', password: '', role: 'teacher', studentId: '', email: '', phone: '', address: '', nextOfKin: '', hireDate: '', employmentType: 'Full-time', monthlySalary: '', permissions: [] as PermissionKey[], assignedClasses: [] as string[] });
  const update = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const data: UserAccountInput = {
      name: form.name, identifier: form.identifier, password: form.password, role: form.role as UserAccountInput['role'],
      userType: form.role === 'student' || form.role === 'guardian' ? 'learner' : 'staff',
      studentId: form.role === 'guardian' || form.role === 'student' ? form.studentId : null,
      email: form.email, phone: form.phone, address: form.address, nextOfKin: form.nextOfKin,
       hireDate: form.hireDate, employmentType: form.employmentType, monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : undefined, permissions: form.permissions, assignedClasses: form.role === 'teacher' ? form.assignedClasses : [],
    };
    create.mutate({ data }, {
      onSuccess: () => {
        trackEvent('account_created', { role: data.role, user_type: data.userType });
          setForm({ name: '', identifier: '', password: '', role: 'teacher', studentId: '', email: '', phone: '', address: '', nextOfKin: '', hireDate: '', employmentType: 'Full-time', monthlySalary: '', permissions: [], assignedClasses: [] });
        client.invalidateQueries({ queryKey: getGetOperationsQueryKey() });
      },
    });
  };
  const permissionOptions: { key: PermissionKey; label: string }[] = [
    { key: 'expense_approve', label: 'Approve expenses' }, { key: 'expense_delete', label: 'Delete expenses' },
    { key: 'transactions_view', label: 'View transactions' }, { key: 'transactions_print', label: 'Print/download/share receipts' },
    { key: 'finance_view', label: 'Access finance & payments' }, { key: 'expenses_view', label: 'Access expenses' },
  ];
  const classRows = operations.data?.modules?.classes || [];
  return <Panel className="border-dashed p-5" testId="panel-create-account"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Plus className="size-4" /></span><div><h2 className="font-display text-xl">Create user account & permissions</h2><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Staff and teachers sign in with usernames. Register the monthly salary now so salary balances remain accurate.</p></div></div><form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-2"><input required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Full names" className={inputClass} data-testid="input-account-name" /><input required value={form.identifier} onChange={(event) => update('identifier', event.target.value)} placeholder={form.role === 'student' ? 'Permanent registration number' : 'Username'} className={inputClass} data-testid="input-account-identifier" /><select value={form.role} onChange={(event) => update('role', event.target.value)} className={inputClass} data-testid="select-account-role">{['teacher', 'accountant', 'staff', 'guardian', 'student'].map((role) => <option key={role} value={role}>{role === 'student' ? 'Pupil' : role[0].toUpperCase() + role.slice(1)}</option>)}</select><input required minLength={8} type="password" value={form.password} onChange={(event) => update('password', event.target.value)} placeholder="Temporary password (8+ characters)" className={inputClass} data-testid="input-account-password" /><input type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Contact number" className={inputClass} data-testid="input-account-phone" /><input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="Email address" className={inputClass} data-testid="input-account-email" /><input value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Home address" className={inputClass} data-testid="input-account-address" /><input value={form.nextOfKin} onChange={(event) => update('nextOfKin', event.target.value)} placeholder="Next of kin / emergency contact" className={inputClass} data-testid="input-account-next-of-kin" /><input type="date" value={form.hireDate} onChange={(event) => update('hireDate', event.target.value)} className={inputClass} data-testid="input-account-hire-date" /><select value={form.employmentType} onChange={(event) => update('employmentType', event.target.value)} className={inputClass} data-testid="select-account-employment-type"><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Volunteer</option></select>{(form.role === 'teacher' || form.role === 'staff') && <input required min={0} type="number" value={form.monthlySalary} onChange={(event) => update('monthlySalary', event.target.value)} placeholder="Monthly salary (UGX)" className={inputClass} data-testid="input-account-monthly-salary" />}{(form.role === 'guardian' || form.role === 'student') && <input required value={form.studentId} onChange={(event) => update('studentId', event.target.value)} placeholder="Linked pupil ID or registration number" className={`${inputClass} md:col-span-2`} data-testid="input-account-student-id" />}{form.role === 'teacher' && <div className="md:col-span-2 rounded-2xl bg-[hsl(var(--muted)/.55)] p-4"><p className="text-xs font-semibold">Assigned classes</p><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Teachers can manage pupils, attendance, and assignments for these classes.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{classRows.map((item) => <label key={item.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.assignedClasses.includes(item.name)} onChange={() => setForm((old) => ({ ...old, assignedClasses: old.assignedClasses.includes(item.name) ? old.assignedClasses.filter((name) => name !== item.name) : [...old.assignedClasses, item.name] }))} />{item.name}</label>)}</div>{!classRows.length && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Create classes first, then assign them here.</p>}</div>}<div className="md:col-span-2 rounded-2xl bg-[hsl(var(--muted)/.55)] p-4"><p className="text-xs font-semibold">Action permissions</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{permissionOptions.map((permission) => <label key={permission.key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.permissions.includes(permission.key)} onChange={() => setForm((old) => ({ ...old, permissions: old.permissions.includes(permission.key) ? old.permissions.filter((item) => item !== permission.key) : [...old.permissions, permission.key] }))} />{permission.label}</label>)}</div></div><div className="md:col-span-2 flex items-center justify-between gap-3">{create.isError && <p className="text-xs text-[hsl(var(--destructive))]">Account could not be created. Check the identifier and linked pupil.</p>}<Button type="submit" disabled={create.isPending} testId="button-create-account">{create.isPending ? 'Creating…' : 'Create account'}</Button></div></form></Panel>;
}

function UserPermissionsPanel() {
  const client = useQueryClient();
  const users = useListUsers();
  const operations = useGetOperations();
  const update = useUpdateUserPermissions();
  const options: { key: PermissionKey; label: string }[] = [
    { key: 'expense_approve', label: 'Approve expenses' }, { key: 'expense_delete', label: 'Delete expenses' },
    { key: 'transactions_view', label: 'View transactions' }, { key: 'transactions_print', label: 'Print/download/share receipts' },
    { key: 'finance_view', label: 'Access finance & payments' }, { key: 'expenses_view', label: 'Access expenses' },
  ];
  const classRows = operations.data?.modules?.classes || [];
  const save = (user: NonNullable<typeof users.data>[number], permissions: PermissionKey[], assignedClasses = user.assignedClasses || []) => update.mutate({ userId: user.id, data: { permissions, assignedClasses } }, { onSuccess: () => client.invalidateQueries({ queryKey: getListUsersQueryKey() }) });
  return <Panel className="p-5" testId="panel-user-permissions"><div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-xl">Users & action permissions</h2><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Administrators always retain approval access. Give an accountant approval access only when needed.</p></div><Button variant="secondary" onClick={() => users.refetch()} testId="button-refresh-users">Refresh</Button></div><div className="mt-5 space-y-3">{users.data?.filter((user) => !['student', 'guardian'].includes(user.role)).map((user) => <div key={user.id} className="rounded-2xl border border-[hsl(var(--border))] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">{user.name}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{user.identifier} · {user.role.replace('_', ' ')}</p></div><span className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.12em]">{user.role === 'administrator' || user.role === 'super_admin' ? 'Full admin access' : 'Configurable'}</span></div>{!['administrator', 'super_admin'].includes(user.role) && <div className="mt-3 grid gap-2 sm:grid-cols-2">{options.map((option) => <label key={option.key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={user.permissions.includes(option.key)} onChange={(event) => { const permissions = event.target.checked ? [...user.permissions, option.key] : user.permissions.filter((item) => item !== option.key); update.mutate({ userId: user.id, data: { permissions } }, { onSuccess: () => client.invalidateQueries({ queryKey: getListUsersQueryKey() }) }); }} />{option.label}</label>)}</div>}</div>)}</div>{users.isError && <p className="mt-3 text-xs text-[hsl(var(--destructive))]">User accounts could not be loaded.</p>}</Panel>;
}

function TeacherAssignmentPanel() {
  const client = useQueryClient();
  const users = useListUsers();
  const operations = useGetOperations();
  const update = useUpdateUserPermissions();
  const teachers = users.data?.filter((user) => user.role === 'teacher') || [];
  const classes = operations.data?.modules?.classes || [];
  const save = (teacher: typeof teachers[number], assignedClasses: string[]) => update.mutate({ userId: teacher.id, data: { permissions: teacher.permissions, assignedClasses } }, { onSuccess: () => client.invalidateQueries({ queryKey: getListUsersQueryKey() }) });
  return <Panel className="p-5" testId="panel-teacher-assignments"><h2 className="font-display text-xl">Teacher class assignments</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Assign or remove classes here. Teachers can access pupils, attendance, and assignments for the classes selected.</p><div className="mt-5 space-y-4">{teachers.map((teacher) => <div key={teacher.id} className="rounded-2xl border border-[hsl(var(--border))] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{teacher.name}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{teacher.identifier}</p></div><span className="text-[11px] text-[hsl(var(--primary))]">{teacher.assignedClasses?.length || 0} assigned</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{classes.map((item) => <label key={item.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={(teacher.assignedClasses || []).includes(item.name)} onChange={(event) => { const assignedClasses = event.target.checked ? [...(teacher.assignedClasses || []), item.name] : (teacher.assignedClasses || []).filter((name) => name !== item.name); save(teacher, assignedClasses); }} />{item.name}</label>)}</div>{!classes.length && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Create a class before assigning it to a teacher.</p>}</div>)}</div>{!teachers.length && <EmptyState icon={Users} title="No teachers yet" description="Create a teacher account to assign classes." />}</Panel>;
}

function ExpenseComposer() {
  const client = useQueryClient();
  const create = useCreateExpense();
  const salaryCreate = useCreateSalaryPayment();
  const salaryStaff = useListSalaryStaff();
  const [salaryStaffId, setSalaryStaffId] = useState('');
  const [salaryPeriod, setSalaryPeriod] = useState('');
  const [salaryMethod, setSalaryMethod] = useState('Bank transfer');
  const [form, setForm] = useState<ExpenseInput>({ category: '', description: '', amount: 0, date: new Date().toISOString().slice(0, 10), reference: '' });
  const update = (key: keyof ExpenseInput, value: string) => setForm((old) => ({ ...old, [key]: key === 'amount' ? Number(value) : value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (form.category === 'Salary') {
      salaryCreate.mutate({ data: { staffId: salaryStaffId, period: salaryPeriod, amount: form.amount, method: salaryMethod, reference: form.reference || '' } }, {
        onSuccess: () => {
          trackEvent('salary_payment_recorded', { payment_method: salaryMethod });
          setForm({ category: '', description: '', amount: 0, date: new Date().toISOString().slice(0, 10), reference: '' });
          setSalaryStaffId('');
          setSalaryPeriod('');
          client.invalidateQueries({ queryKey: getGetOperationsQueryKey() });
          client.invalidateQueries({ queryKey: getListSalariesQueryKey() });
          client.invalidateQueries({ queryKey: getListSalaryStaffQueryKey() });
        },
      });
      return;
    }
    create.mutate({ data: form }, {
      onSuccess: () => {
        trackEvent('expense_recorded');
        setForm({ category: '', description: '', amount: 0, date: new Date().toISOString().slice(0, 10), reference: '' });
         client.invalidateQueries({ queryKey: getGetOperationsQueryKey() });
      },
    });
  };
  const commonCategories = ['Posho', 'Beans', 'Electricity', 'Firewood', 'Salary'];
  return <Panel className="border-dashed p-5" testId="panel-create-expense"><h2 className="font-display text-xl">Record a school expense</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Use a common category or type a new one. Select Salary to pay a registered teacher or staff member from their monthly salary balance.</p><form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-4"><select required value={commonCategories.includes(form.category) ? form.category : form.category ? 'Other' : ''} onChange={(event) => update('category', event.target.value === 'Other' ? '' : event.target.value)} className={inputClass} data-testid="select-expense-category"><option value="" disabled>Choose category</option><option>Posho</option><option>Beans</option><option>Electricity</option><option>Firewood</option><option>Salary</option><option>Other</option></select>{!commonCategories.includes(form.category) && <input required value={form.category} onChange={(event) => update('category', event.target.value)} placeholder="Create custom category" className={inputClass} data-testid="input-expense-category" />}{form.category === 'Salary' && <><select required value={salaryStaffId} onChange={(event) => { const id = event.target.value; const staff = salaryStaff.data?.find((item) => item.id === id); setSalaryStaffId(id); setForm((old) => ({ ...old, amount: staff?.monthlySalary || 0, description: staff ? `Salary payment for ${staff.name}` : '' })); }} className={inputClass} data-testid="select-expense-salary-staff"><option value="" disabled>Choose teacher or staff</option>{salaryStaff.data?.map((staff) => <option key={staff.id} value={staff.id}>{staff.name} · {staff.role} · {money(staff.monthlySalary)}</option>)}</select><input required value={salaryPeriod} onChange={(event) => setSalaryPeriod(event.target.value)} placeholder="Salary period e.g. Sep 2026" className={inputClass} data-testid="input-expense-salary-period" /><select value={salaryMethod} onChange={(event) => setSalaryMethod(event.target.value)} className={inputClass} data-testid="select-expense-salary-method"><option>Bank transfer</option><option>Mobile money</option><option>Cash</option></select></>}<input required value={form.description} onChange={(event) => update('description', event.target.value)} placeholder={form.category === 'Salary' ? 'Salary reason' : 'Reason / description'} className={inputClass} data-testid="input-expense-description" /><input required min={1} type="number" value={form.amount || ''} onChange={(event) => update('amount', event.target.value)} placeholder="Amount" className={inputClass} data-testid="input-expense-amount" /><input value={form.reference || ''} onChange={(event) => update('reference', event.target.value)} placeholder="Payment reference (optional)" className={inputClass} data-testid="input-expense-reference" /><input required type="date" value={form.date} onChange={(event) => update('date', event.target.value)} className={inputClass} data-testid="input-expense-date" /><div className="md:col-span-3 flex justify-end"><Button type="submit" disabled={create.isPending || salaryCreate.isPending} testId="button-create-expense">{create.isPending || salaryCreate.isPending ? 'Saving…' : form.category === 'Salary' ? 'Pay salary & issue receipt' : 'Save expense'}</Button></div></form>{(create.isError || salaryCreate.isError) && <p className="mt-3 text-sm text-[hsl(var(--destructive))]">{form.category === 'Salary' ? 'Salary payment could not be recorded. Check the registered salary balance and selected staff member.' : 'Expense could not be saved.'}</p>}</Panel>;
}

function SalaryComposer() {
  const client = useQueryClient();
  const create = useCreateSalaryPayment();
  const salaryStaff = useListSalaryStaff();
  const salaries = useListSalaries();
  const [form, setForm] = useState<SalaryPaymentInput>({ staffId: '', period: '', amount: 0, method: 'Bank transfer', reference: '' });
  const update = (key: keyof SalaryPaymentInput, value: string) => setForm((old) => ({ ...old, [key]: key === 'amount' ? Number(value) : value }));
  const selectedStaff = salaryStaff.data?.find((item) => item.id === form.staffId);
  const paidForPeriod = salaries.data?.filter((item) => item.staffId === form.staffId && item.period === form.period).reduce((sum, item) => sum + item.amount, 0) || 0;
  const balance = Math.max(0, (selectedStaff?.monthlySalary || 0) - paidForPeriod);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate({ data: form }, {
      onSuccess: () => {
        trackEvent('salary_payment_recorded', { payment_method: form.method });
        setForm({ staffId: '', period: '', amount: 0, method: 'Bank transfer', reference: '' });
         client.invalidateQueries({ queryKey: getGetOperationsQueryKey() });
         client.invalidateQueries({ queryKey: getListSalariesQueryKey() });
         client.invalidateQueries({ queryKey: getListSalaryStaffQueryKey() });
      },
    });
  };
  return <Panel className="border-dashed p-5" testId="panel-create-salary"><h2 className="font-display text-xl">Record a salary payment</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Select a registered teacher or staff member. The monthly salary and remaining period balance are shown before payment.</p><form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-5"><select required value={form.staffId} onChange={(event) => { const staffId = event.target.value; const staff = salaryStaff.data?.find((item) => item.id === staffId); setForm((old) => ({ ...old, staffId, amount: staff?.monthlySalary || 0 })); }} className={inputClass} data-testid="select-salary-staff"><option value="" disabled>Choose teacher or staff</option>{salaryStaff.data?.map((staff) => <option key={staff.id} value={staff.id}>{staff.name} · {staff.role} · {money(staff.monthlySalary)}</option>)}</select><input required value={form.period} onChange={(event) => update('period', event.target.value)} placeholder="Period e.g. Sep 2026" className={inputClass} data-testid="input-salary-period" /><input required min={1} max={balance || undefined} type="number" value={form.amount || ''} onChange={(event) => update('amount', event.target.value)} placeholder="Amount" className={inputClass} data-testid="input-salary-amount" /><select value={form.method} onChange={(event) => update('method', event.target.value)} className={inputClass} data-testid="select-salary-method"><option>Bank transfer</option><option>Mobile money</option><option>Cash</option></select><input value={form.reference} onChange={(event) => update('reference', event.target.value)} placeholder="Reference (optional)" className={inputClass} data-testid="input-salary-reference" /><div className="md:col-span-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[hsl(var(--muted-foreground))]">{selectedStaff ? `Monthly salary: ${money(selectedStaff.monthlySalary)} · Paid this period: ${money(paidForPeriod)} · Balance: ${money(balance)}` : 'Choose a registered teacher or staff member to see their salary balance.'}</p><Button type="submit" disabled={create.isPending || !selectedStaff || balance <= 0} testId="button-create-salary">{create.isPending ? 'Saving…' : 'Pay salary & issue receipt'}</Button></div></form>{salaries.data?.filter((item) => item.staffId === form.staffId).length ? <div className="mt-5 overflow-x-auto rounded-2xl border border-[hsl(var(--border))]"><table className="w-full text-left text-xs"><thead className="bg-[hsl(var(--muted)/.55)]"><tr><th className="p-3">Period</th><th className="p-3">Date</th><th className="p-3">Receipt</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Balance</th></tr></thead><tbody>{salaries.data.filter((item) => item.staffId === form.staffId).map((item) => <tr key={item.id} className="border-t border-[hsl(var(--border))]"><td className="p-3">{item.period}</td><td className="p-3">{item.paymentDate}</td><td className="p-3"><Link href={`/salary-receipts/${item.id}`} className="font-mono-ui font-semibold text-[hsl(var(--primary))] hover:underline">{item.receiptNumber}</Link></td><td className="p-3 text-right font-semibold">{money(item.amount)}</td><td className="p-3 text-right">{money(item.balance)}</td></tr>)}</tbody></table></div> : null}</Panel>;
}

function OperationsRows({ view, rows, currency, canApprove, canDelete }: { view: ViewKey; rows: Row[]; currency: string; canApprove?: boolean; canDelete?: boolean }) {
  const approve = useApproveExpense();
  const remove = useDeleteExpense();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: getGetOperationsQueryKey() });
  if (!rows.length) return <EmptyState icon={Archive} title={`No ${view} to show`} description="This record is empty. Add the first entry when your school is ready." />;
  const preferredColumns: Record<ViewKey, string[]> = {
    people: ['name', 'role', 'phone', 'status', 'children'], classes: ['name', 'teacherName', 'pupilCount', 'room'], assignments: ['title', 'subject', 'className', 'dueDate', 'status'],
    staff: ['name', 'role', 'phone', 'status'], parents: ['name', 'phone', 'children'], expenses: ['category', 'description', 'amount', 'date', 'status'], salaries: ['staffName', 'period', 'amount', 'paymentDate', 'method', 'status'],
    discipline: ['studentName', 'className', 'incident', 'level', 'date'], medical: ['studentName', 'className', 'condition', 'notes', 'lastUpdated'], library: ['title', 'author', 'copiesAvailable', 'status'],
    transport: ['route', 'driver', 'vehicle', 'students', 'status'], inventory: ['item', 'category', 'quantity', 'reorderLevel', 'status'], events: ['title', 'date', 'type', 'location', 'status'],
    documents: ['name', 'type', 'updatedAt', 'visibility'], reports: ['title', 'description', 'period', 'status'], notifications: ['title', 'body', 'date', 'read'],
  };
  const columns = preferredColumns[view].filter((column) => rows.some((row) => row[column] !== undefined));
  return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)]"><tr>{columns.map((column) => <th key={column} className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{pretty(column)}</th>)}{(view === 'classes' || view === 'expenses') && <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Actions</th>}</tr></thead><tbody className="divide-y divide-[hsl(var(--border))]">{rows.map((row, index) => <tr key={String(row.id || index)} className="transition-colors hover:bg-[hsl(var(--muted)/.35)]" data-testid={`row-operation-${view}-${row.id || index}`}>{columns.map((column) => <td key={column} className={`max-w-[260px] px-5 py-4 text-sm ${column === 'status' ? 'font-semibold' : ''} ${column === 'description' || column === 'notes' || column === 'body' ? 'text-[hsl(var(--muted-foreground))]' : ''}`}>{column === 'amount' ? money(row[column], currency) : (column === 'status' && typeof row[column] === 'string' ? String(row[column]) : compactValue(row[column]))}</td>)}{view === 'classes' && <td className="px-5 py-5"><span className="flex items-center gap-3 whitespace-nowrap"><Link href={`/attendance?className=${encodeURIComponent(String(row.name))}`} className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline">Attendance</Link><Link href="/operations?view=assignments" className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline">Assignments</Link></span></td>}{view === 'expenses' && <td className="px-5 py-5"><div className="flex flex-wrap gap-2">{canApprove && row.status !== 'Approved' && <button className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline" disabled={approve.isPending} onClick={() => approve.mutate({ expenseId: String(row.id) }, { onSuccess: refresh })}>Approve</button>}{canDelete && <button className="text-xs font-semibold text-[hsl(var(--destructive))] hover:underline" onClick={() => { if (window.confirm('Delete this expense record?')) remove.mutate({ expenseId: String(row.id) }, { onSuccess: refresh }); }}>Delete</button>}</div></td>}</tr>)}</tbody></table></div>;
}

export function OperationsPage() {
  const [location] = useLocation();
  const { data: session } = useGetCurrentUser();
  const query = useGetOperations();
  const role = session?.user.role || query.data?.role || 'staff';
  const baseViews = roleViews[role] || roleViews.staff;
  const visibleViews = views.filter((item) => baseViews.includes(item.key) || ((item.key === 'expenses') && session?.user.permissions.includes('expenses_view')));
  const requested = new URLSearchParams(location.split('?')[1] || '').get('view') as ViewKey | null;
  const view = visibleViews.some((item) => item.key === requested) ? requested as ViewKey : visibleViews[0]?.key || 'events';
  const selected = views.find((item) => item.key === view) || views[0];
  const rows = useMemo(() => {
    const moduleRows = view === 'people' ? [...(query.data?.modules?.staff || []), ...(query.data?.modules?.parents || [])] : query.data?.modules?.[view];
    return (moduleRows || []) as unknown as Row[];
  }, [query.data, view]);
  const isAdmin = role === 'administrator' || role === 'super_admin';
  const isFinance = isAdmin || role === 'accountant' || session?.user.permissions.includes('expenses_view');
  const availableActions = query.data?.actions || [];
  return <AppShell><PageHeader eyebrow={`${role.replace('_', ' ')} · Operations`} title="Operations hub" description="Work only with the records and actions available to your role." action={<Button variant="secondary" onClick={() => query.refetch()} testId="button-refresh-operations"><RefreshCcw className="size-4" /> Refresh</Button>} />{query.isError ? <Panel><ErrorState onRetry={() => query.refetch()} /></Panel> : query.isLoading ? <OperationsSkeleton /> : <div className="space-y-6">
    {availableActions.length > 0 && <div className="flex flex-wrap gap-2">{availableActions.slice(0, 3).map((action) => <Link href={action.href} key={action.id} className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2 text-xs font-semibold text-[hsl(var(--primary))]" data-testid={`link-operations-action-${action.id}`}>{action.label}<ArrowRight className="size-3.5" /></Link>)}</div>}
     <div className="grid gap-6 lg:grid-cols-[250px_1fr]"><Panel className="h-fit p-2" testId="panel-operations-switcher"><p className="px-3 pb-2 pt-2 font-mono-ui text-[10px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Your work areas</p>{visibleViews.map(({ key, label, icon: Icon }) => { const active = key === view; const count = key === 'people' ? (query.data?.modules?.staff.length || 0) + (query.data?.modules?.parents.length || 0) : (query.data?.modules?.[key] || []).length; return <Link href={`/operations?view=${key}`} key={key} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? 'bg-[hsl(var(--secondary))] font-semibold text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`} data-testid={`link-operation-view-${key}`}><Icon className="size-[17px]" /><span className="flex-1">{label}</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground)/.7)]">{count}</span></Link>; })}</Panel><div className="min-w-0 space-y-6"><Panel className="overflow-hidden" testId={`panel-operation-view-${view}`}><div className="flex flex-col justify-between gap-3 border-b border-[hsl(var(--border))] p-5 sm:flex-row sm:items-center"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">{query.data?.currencyCode || 'UGX'}</p><h2 className="mt-1 font-display text-2xl">{selected.label}</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{rows.length ? `${rows.length} record${rows.length === 1 ? '' : 's'} available to you` : 'No records have been created yet'}</p></div>{isFinance && view === 'expenses' && <Link href="/finance" className="text-xs font-semibold text-[hsl(var(--primary))]">Open finance <ArrowRight className="ml-1 inline size-3.5" /></Link>}</div><OperationsRows view={view} rows={rows} currency={query.data?.currencyCode || 'UGX'} canApprove={isAdmin || session?.user.permissions.includes('expense_approve')} canDelete={isAdmin || session?.user.permissions.includes('expense_delete')} /></Panel>
        {isAdmin && view === 'people' && <><CreateAccountPanel /><UserPermissionsPanel /><TeacherAssignmentPanel /></>}
      {isFinance && view === 'expenses' && <ExpenseComposer />}
      {isFinance && view === 'salaries' && <SalaryComposer />}
    </div></div>
  </div>}</AppShell>;
}