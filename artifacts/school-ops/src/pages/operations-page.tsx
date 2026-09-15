import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { type AuthUser, type ClassInput, type ExpenseInput, type PermissionKey, type SalaryPaymentInput, type TeacherRegistrationForm, type UserAccountInput, type UserAdminProfileUpdate, useApproveExpense, useCreateClass, useCreateExpense, useCreateSalaryPayment, useCreateUser, useDeleteExpense, useGetCurrentUser, useGetOperations, getGetOperationsQueryKey, useListSalaryStaff, useListSalaries, useListUsers, useUpdateUserPermissions, useUpdateUserProfileByAdmin, getListUsersQueryKey, getListSalaryStaffQueryKey, getListSalariesQueryKey } from '@workspace/api-client-react';
import { Archive, ArrowRight, BarChart3, Bell, BookOpen, BusFront, CalendarDays, Check, ClipboardList, Download, FileText, HeartPulse, KeyRound, Library, Package, Pencil, Plus, Printer, Receipt, RefreshCcw, Search, ShieldAlert, UserRound, Users, WalletCards, X } from 'lucide-react';
import { AppShell, Button, EmptyState, ErrorState, PageHeader, Panel, Skeleton } from '@/components/school-shell';
import { trackEvent } from '@/lib/analytics';
import { brandedPdf } from './school-pages';

 type ViewKey = 'people' | 'classes' | 'subjects' | 'assignments' | 'staff' | 'parents' | 'expenses' | 'salaries' | 'discipline' | 'medical' | 'library' | 'transport' | 'inventory' | 'events' | 'documents' | 'reports' | 'notifications';
type Row = Record<string, string | number | boolean>;

const views: { key: ViewKey; label: string; icon: typeof ClipboardList }[] = [
  { key: 'people', label: 'Users & Roles', icon: Users }, { key: 'classes', label: 'Classes', icon: Users }, { key: 'subjects', label: 'Subjects', icon: BookOpen }, { key: 'assignments', label: 'Assignments', icon: ClipboardList },
  { key: 'staff', label: 'Staff', icon: Users }, { key: 'parents', label: 'Parents', icon: Users }, { key: 'expenses', label: 'Expenses', icon: Receipt },
  { key: 'salaries', label: 'Salaries', icon: WalletCards }, { key: 'discipline', label: 'Discipline', icon: ShieldAlert }, { key: 'medical', label: 'Medical', icon: HeartPulse },
  { key: 'library', label: 'Library', icon: Library }, { key: 'transport', label: 'Transport', icon: BusFront }, { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'events', label: 'Events', icon: CalendarDays }, { key: 'documents', label: 'Documents', icon: FileText }, { key: 'reports', label: 'Reports', icon: BarChart3 }, { key: 'notifications', label: 'Notifications', icon: Bell },
];

const roleViews: Record<string, ViewKey[]> = {
  administrator: views.map((item) => item.key),
  super_admin: views.map((item) => item.key),
  teacher: ['classes', 'subjects', 'assignments', 'discipline', 'medical', 'events', 'documents', 'notifications'],
  accountant: ['expenses', 'salaries', 'reports', 'documents', 'notifications'],
  guardian: ['assignments', 'discipline', 'medical', 'library', 'transport', 'events', 'notifications'],
  student: ['assignments', 'library', 'transport', 'events', 'notifications'],
  staff: ['events', 'documents', 'notifications'],
};

const pretty = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
const compactValue = (value: string | number | boolean | undefined) => value === undefined ? '—' : typeof value === 'boolean' ? (value ? 'Read' : 'Unread') : String(value);
const money = (value: string | number | boolean | undefined, currency = 'UGX') => typeof value === 'number' ? new Intl.NumberFormat('en-UG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) : compactValue(value);
const inputClass = 'focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm outline-none';
const customExpenseCategory = '__custom__';
const expenseCategoryGroups = [
  { label: 'Staff Expenses', options: ["Teachers' salaries", 'Non-teaching staff salaries', 'Allowances', 'Staff welfare', 'Staff training', 'Staff meals'] },
  { label: 'Academic Expenses', options: ['Books and textbooks', 'Printing and photocopying', 'Stationery', 'Examination materials', 'Teaching aids', 'Laboratory materials', 'Computer/ICT materials'] },
  { label: 'Food & Boarding', options: ['Food purchases', 'Drinking water', 'Cooking gas/firewood', 'Kitchen supplies', 'Bedding', 'Mattresses', 'Boarding supplies'] },
  { label: 'Utilities', options: ['Electricity', 'Water', 'Internet', 'Telephone/communication', 'Garbage collection'] },
  { label: 'Transport', options: ['Fuel', 'Vehicle maintenance', 'Vehicle insurance', 'Driver expenses', 'School bus repairs', 'Transport allowances'] },
  { label: 'Buildings & Maintenance', options: ['Building repairs', 'Plumbing', 'Electrical repairs', 'Painting', 'Furniture repairs', 'Classroom maintenance', 'Compound maintenance', 'Security infrastructure'] },
  { label: 'Office & Administration', options: ['Office stationery', 'Printer ink/toner', 'Computers and accessories', 'Software subscriptions', 'Bank charges', 'Postage/courier', 'Legal/professional fees'] },
  { label: 'Student Welfare', options: ['Medical expenses', 'Sports equipment', 'Games and competitions', 'Clubs and activities', 'Student counseling', 'Awards and certificates'] },
  { label: 'Security & Cleaning', options: ['Security guards', 'Cleaning materials', 'Cleaning staff', 'Security equipment', 'Compound cleaning'] },
  { label: 'Marketing & Publicity', options: ['Advertising', 'Posters', 'Banners', 'Social media promotion', 'School brochures'] },
  { label: 'Taxes & Licenses', options: ['Government fees', 'Trading/business licenses', 'Local authority fees', 'Tax-related expenses', 'Inspection fees'] },
  { label: 'Other Expenses', options: ['Bank/financial charges', 'Emergency expenses', 'Donations', 'Events', 'Graduation expenses', 'Meetings', 'Miscellaneous expenses'] },
] as const;
const salaryExpenseCategories = ["Teachers' salaries", 'Non-teaching staff salaries'] as const;

async function downloadTeacherRegistration(form: TeacherRegistrationForm) {
  const pdf = await brandedPdf([
    'OFFICIAL TEACHER REGISTRATION FORM',
    `Teacher: ${form.name}`,
    `Username: ${form.username}`,
    `Email: ${form.email || 'Not provided'}`,
    `Phone: ${form.phone || 'Not provided'}`,
    `Address: ${form.address || 'Not provided'}`,
    `Next of kin: ${form.nextOfKin || 'Not provided'}`,
    `Hire date: ${form.hireDate || 'Not provided'}`,
    `Employment type: ${form.employmentType}`,
    `Monthly salary: ${money(form.monthlySalary)}`,
    `Assigned classes: ${form.assignedClasses.join(', ')}`,
    `Action permissions: ${form.permissions.length ? form.permissions.join(', ') : 'None'}`,
    `Registered at: ${form.registeredAt}`,
    'This is an official EMMECTY school teacher registration record.',
  ]);
  const url = URL.createObjectURL(pdf);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${form.username}-teacher-registration.pdf`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printTeacherRegistration(form: TeacherRegistrationForm) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const row = (label: string, value: string) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  printWindow.document.write(`<html><head><title>${form.name} teacher registration</title><style>body{font-family:Arial,sans-serif;color:#17231f;padding:48px;max-width:720px;margin:auto}header{border-bottom:3px solid #1d7056;padding-bottom:18px;margin-bottom:28px;min-height:88px}header img{float:right;width:84px;height:86px;object-fit:contain}h1{font-size:24px;margin:0 0 6px}p{color:#63756e}dl{display:grid;grid-template-columns:1fr 1fr;gap:18px 32px}dt{font-size:11px;color:#63756e;text-transform:uppercase;letter-spacing:.12em}dd{font-size:16px;font-weight:600;margin:5px 0 0}.classes{grid-column:1/-1;border-top:1px solid #d9e2dc;padding-top:18px}@media print{body{padding:0}}</style></head><body><header><img src="/school-logo.jpg" alt="EMMECTY Nursery & Primary School logo"><h1>EMMECTY NURSERY & PRIMARY SCHOOL</h1><p>Official teacher registration form</p></header><dl>${row('Teacher', form.name)}${row('Username', form.username)}${row('Email', form.email || 'Not provided')}${row('Phone', form.phone || 'Not provided')}${row('Address', form.address || 'Not provided')}${row('Next of kin', form.nextOfKin || 'Not provided')}${row('Hire date', form.hireDate || 'Not provided')}${row('Employment type', form.employmentType)}${row('Monthly salary', money(form.monthlySalary))}<div class="classes"><dt>Assigned classes</dt><dd>${form.assignedClasses.join(', ')}</dd></div><div class="classes"><dt>Action permissions</dt><dd>${form.permissions.length ? form.permissions.join(', ') : 'None'}</dd></div></dl><p style="margin-top:56px">This is an official EMMECTY school teacher registration record.</p></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function OperationsSkeleton() {
  return <div className="grid gap-6 lg:grid-cols-[250px_1fr]"><Panel className="p-4"><Skeleton className="h-5 w-32" /><div className="mt-5 space-y-3">{[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-10 w-full" />)}</div></Panel><Panel className="p-6"><Skeleton className="h-8 w-52" /><Skeleton className="mt-8 h-48 w-full" /></Panel></div>;
}

function CreateAccountPanel() {
  const client = useQueryClient();
  const create = useCreateUser();
  const operations = useGetOperations();
  const [form, setForm] = useState({ name: '', identifier: '', password: '', role: 'staff', studentId: '', email: '', phone: '', address: '', nextOfKin: '', hireDate: '', employmentType: 'Full-time', monthlySalary: '', permissions: [] as PermissionKey[], assignedClasses: [] as string[] });
  const [assignmentError, setAssignmentError] = useState('');
  const [teacherConfirmation, setTeacherConfirmation] = useState<TeacherRegistrationForm | null>(null);
  const update = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (form.role === 'teacher' && form.assignedClasses.length === 0) {
      setAssignmentError('Assign at least one class before registering a teacher.');
      return;
    }
    setAssignmentError('');
    const data: UserAccountInput = {
      name: form.name, identifier: form.identifier, password: form.password, role: form.role as UserAccountInput['role'],
      userType: form.role === 'student' || form.role === 'guardian' ? 'learner' : 'staff',
      studentId: form.role === 'guardian' || form.role === 'student' ? form.studentId : null,
      email: form.email, phone: form.phone, address: form.address, nextOfKin: form.nextOfKin,
       hireDate: form.hireDate, employmentType: form.employmentType, monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : undefined, permissions: form.permissions, assignedClasses: form.role === 'teacher' ? form.assignedClasses : [],
    };
    create.mutate({ data }, {
       onSuccess: (account) => {
        trackEvent('account_created', { role: data.role, user_type: data.userType });
         if (data.role === 'teacher' && account.registrationForm) setTeacherConfirmation(account.registrationForm);
           setForm({ name: '', identifier: '', password: '', role: 'staff', studentId: '', email: '', phone: '', address: '', nextOfKin: '', hireDate: '', employmentType: 'Full-time', monthlySalary: '', permissions: [], assignedClasses: [] });
        setAssignmentError('');
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
  if (teacherConfirmation) return <Panel className="border-dashed p-5" testId="panel-teacher-registration-confirmation"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Users className="size-5" /></span><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Teacher registered</p><h2 className="font-display text-2xl">Teacher registration form ready</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">The teacher account and assigned classes were saved successfully.</p></div></div><dl className="mt-6 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Teacher</dt><dd className="mt-1 text-sm font-semibold">{teacherConfirmation.name}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Username</dt><dd className="mt-1 font-mono-ui text-sm font-semibold">{teacherConfirmation.username}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Phone</dt><dd className="mt-1 text-sm font-semibold">{teacherConfirmation.phone || 'Not provided'}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Monthly salary</dt><dd className="mt-1 text-sm font-semibold">{money(teacherConfirmation.monthlySalary)}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-[hsl(var(--muted-foreground))]">Assigned classes</dt><dd className="mt-1 text-sm font-semibold">{teacherConfirmation.assignedClasses.join(', ')}</dd></div></dl><div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[hsl(var(--border))] pt-5"><Button variant="secondary" onClick={() => void downloadTeacherRegistration(teacherConfirmation)} testId="button-download-teacher-registration"><Download className="size-4" /> Download PDF</Button><Button variant="secondary" onClick={() => printTeacherRegistration(teacherConfirmation)} testId="button-print-teacher-registration"><Printer className="size-4" /> Print registration</Button><Button onClick={() => setTeacherConfirmation(null)} testId="button-finish-teacher-registration">Register another account</Button></div></Panel>;
  return <Panel className="border-dashed p-5" testId="panel-create-account"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Plus className="size-4" /></span><div><h2 className="font-display text-xl">Create user account & permissions</h2><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Staff and teachers sign in with usernames. Register the monthly salary now so salary balances remain accurate.</p></div></div><form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-2"><input required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Full names" className={inputClass} data-testid="input-account-name" /><input required value={form.identifier} onChange={(event) => update('identifier', event.target.value)} placeholder={form.role === 'student' ? 'Permanent registration number' : 'Username'} className={inputClass} data-testid="input-account-identifier" /><select value={form.role} onChange={(event) => { const role = event.target.value; setForm((old) => ({ ...old, role, assignedClasses: role === 'teacher' ? old.assignedClasses : [] })); setAssignmentError(''); }} className={inputClass} data-testid="select-account-role">{['teacher', 'accountant', 'staff', 'guardian', 'student'].map((role) => <option key={role} value={role}>{role === 'student' ? 'Pupil' : role[0].toUpperCase() + role.slice(1)}</option>)}</select><input required minLength={8} type="password" value={form.password} onChange={(event) => update('password', event.target.value)} placeholder="Temporary password (8+ characters)" className={inputClass} data-testid="input-account-password" /><input type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Contact number" className={inputClass} data-testid="input-account-phone" /><input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="Email address" className={inputClass} data-testid="input-account-email" /><input value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Home address" className={inputClass} data-testid="input-account-address" /><input value={form.nextOfKin} onChange={(event) => update('nextOfKin', event.target.value)} placeholder="Next of kin / emergency contact" className={inputClass} data-testid="input-account-next-of-kin" /><input type="date" value={form.hireDate} onChange={(event) => update('hireDate', event.target.value)} className={inputClass} data-testid="input-account-hire-date" /><select value={form.employmentType} onChange={(event) => update('employmentType', event.target.value)} className={inputClass} data-testid="select-account-employment-type"><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Volunteer</option></select>{(form.role === 'teacher' || form.role === 'staff') && <input required min={0} type="number" value={form.monthlySalary} onChange={(event) => update('monthlySalary', event.target.value)} placeholder="Monthly salary (UGX)" className={inputClass} data-testid="input-account-monthly-salary" />}{(form.role === 'guardian' || form.role === 'student') && <input required value={form.studentId} onChange={(event) => update('studentId', event.target.value)} placeholder="Linked pupil ID or registration number" className={`${inputClass} md:col-span-2`} data-testid="input-account-student-id" />}{form.role === 'teacher' && <fieldset className={`md:col-span-2 rounded-2xl bg-[hsl(var(--muted)/.55)] p-4 ${assignmentError ? 'border border-[hsl(var(--destructive)/.45)]' : ''}`}><legend className="px-1 text-xs font-semibold">Assigned classes <span className="text-[hsl(var(--destructive))]">*</span></legend><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Choose one or more classes. Use Ctrl/Cmd-click or tap to select multiple.</p><select required multiple value={form.assignedClasses} onChange={(event) => { setForm((old) => ({ ...old, assignedClasses: Array.from(event.target.selectedOptions, (option) => option.value) })); setAssignmentError(''); }} className={`${inputClass} h-auto min-h-24 py-2`} data-testid="select-account-classes">{classRows.map((item) => <option key={item.id} value={item.name}>{item.name}{item.stream ? ` · ${item.stream}` : ''}</option>)}</select>{!classRows.length && <p className="mt-2 text-xs text-[hsl(var(--destructive))]">Create at least one class before registering a teacher.</p>}{assignmentError && <p className="mt-2 text-xs text-[hsl(var(--destructive))]" role="alert" data-testid="status-account-class-error">{assignmentError}</p>}</fieldset>}<div className="md:col-span-2 rounded-2xl bg-[hsl(var(--muted)/.55)] p-4"><p className="text-xs font-semibold">Action permissions</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{permissionOptions.map((permission) => <label key={permission.key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.permissions.includes(permission.key)} onChange={() => setForm((old) => ({ ...old, permissions: old.permissions.includes(permission.key) ? old.permissions.filter((item) => item !== permission.key) : [...old.permissions, permission.key] }))} />{permission.label}</label>)}</div></div><div className="md:col-span-2 flex items-center justify-between gap-3">{create.isError && <p className="text-xs text-[hsl(var(--destructive))]">Account could not be created. Check the identifier, linked pupil, and assigned class.</p>}<Button type="submit" disabled={create.isPending || (form.role === 'teacher' && (!classRows.length || !form.assignedClasses.length))} testId="button-create-account">{create.isPending ? 'Creating…' : 'Create account'}</Button></div></form></Panel>;
}

function UsersRolesDirectoryLegacy({ createMode, onBack }: { createMode: boolean; onBack: () => void }) {
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const users = useListUsers();
  const update = useUpdateUserProfileByAdmin();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ name: '', identifier: '', email: '', phone: '', newPassword: '' });
  const staffUsers = (users.data || []).filter((user) => ['super_admin', 'administrator', 'teacher', 'accountant', 'staff'].includes(user.role));
  const selectedUser = staffUsers.find((user) => user.id === selectedId);
  const chooseUser = (user: AuthUser) => {
    setSelectedId(user.id);
    setSaved(false);
    setForm({ name: user.name, identifier: user.identifier, email: user.email, phone: user.phone, newPassword: '' });
  };
  const updateField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser) return;
    const data: UserAdminProfileUpdate = {
      name: form.name.trim(),
      identifier: form.identifier.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      ...(form.newPassword.trim() ? { newPassword: form.newPassword } : {}),
    };
    setSaved(false);
    update.mutate({ userId: selectedUser.id, data }, {
      onSuccess: (updated) => {
        setForm({ name: updated.name, identifier: updated.identifier, email: updated.email, phone: updated.phone, newPassword: '' });
        setSaved(true);
        client.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
    });
  };
  if (createMode) {
    return <div className="space-y-4"><div><Button variant="quiet" onClick={onBack} testId="button-back-to-users"><ArrowRight className="size-4 rotate-180" /> Back to Users & Roles</Button></div><CreateAccountPanel /></div>;
  }
  return <div className="space-y-6">
    <Panel className="p-5" testId="panel-registered-staff">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Registered staff</p><h2 className="mt-1 font-display text-2xl">Staff accounts</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Select a staff member to update their username, password, email, phone number, and other account details.</p></div>
        <button type="button" onClick={() => setLocation('/operations?view=people&mode=create')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:brightness-110" data-testid="button-create-new-staff"><Plus className="size-4" /> Create new staff</button>
      </div>
      {users.isLoading ? <div className="mt-6 space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div> : users.isError ? <div className="mt-6"><ErrorState onRetry={() => users.refetch()} message="Registered staff accounts could not be loaded." /></div> : !staffUsers.length ? <div className="mt-6"><EmptyState icon={Users} title="No staff accounts yet" description="Create the first teacher or staff account to start managing school access." action={<button type="button" onClick={() => setLocation('/operations?view=people&mode=create')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))]" data-testid="button-create-first-staff"><Plus className="size-4" /> Create new staff</button>} /></div> : <div className="mt-6 grid gap-3">{staffUsers.map((user) => <button type="button" key={user.id} onClick={() => chooseUser(user)} className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors hover:border-[hsl(var(--primary)/.35)] hover:bg-[hsl(var(--secondary)/.35)] ${selectedId === user.id ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary)/.45)]' : 'border-[hsl(var(--border))]'}`} data-testid={`button-staff-user-${user.id}`}><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-sm font-bold text-[hsl(var(--primary))]">{user.initials}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.name}</span><span className="mt-1 block truncate text-xs text-[hsl(var(--muted-foreground))]">{user.identifier} · {user.role.replace('_', ' ')}</span></span><span className="hidden text-right text-xs text-[hsl(var(--muted-foreground))] sm:block">{user.email || 'No email'}<br />{user.phone || 'No phone'}</span><Pencil className="size-4 shrink-0 text-[hsl(var(--muted-foreground))]" /></button>)}</div>}
    </Panel>
    {selectedUser && <Panel className="p-5" testId="panel-edit-staff"><div className="flex items-start justify-between gap-3"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Edit account</p><h2 className="mt-1 font-display text-2xl">{selectedUser.name}</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Changes apply to the account used to sign in.</p></div><button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Close edit account" data-testid="button-close-edit-staff"><X className="size-4" /></button></div><form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold">Full name<input required value={form.name} onChange={(event) => updateField('name', event.target.value)} className={`${inputClass} mt-1`} data-testid="input-edit-staff-name" /></label><label className="text-xs font-semibold">Username<input required value={form.identifier} onChange={(event) => updateField('identifier', event.target.value)} className={`${inputClass} mt-1`} data-testid="input-edit-staff-username" /></label><label className="text-xs font-semibold">Email<input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} className={`${inputClass} mt-1`} data-testid="input-edit-staff-email" /></label><label className="text-xs font-semibold">Phone number<input type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} className={`${inputClass} mt-1`} data-testid="input-edit-staff-phone" /></label><label className="text-xs font-semibold md:col-span-2">New password <span className="font-normal text-[hsl(var(--muted-foreground))]">(leave blank to keep the current password)</span><input minLength={8} type="password" value={form.newPassword} onChange={(event) => updateField('newPassword', event.target.value)} placeholder="Enter a new password (8+ characters)" className={`${inputClass} mt-1`} data-testid="input-edit-staff-password" /></label><div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">{update.isError && <p className="text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="status-edit-staff-error">This account could not be updated. Check the username and try again.</p>}{saved && <p className="flex items-center gap-1.5 text-sm text-[hsl(var(--primary))]" data-testid="status-edit-staff-saved"><Check className="size-4" /> Account updated</p>}<Button type="submit" disabled={update.isPending} testId="button-save-staff-account">{update.isPending ? 'Saving…' : 'Save account changes'}</Button></div></form></Panel>}
  </div>;
}

function CreateClassPanel() {
  const client = useQueryClient();
  const create = useCreateClass();
  const users = useListUsers();
  const [form, setForm] = useState<ClassInput>({ name: '', grade: '', stream: '', room: '', teacherId: null });
  const update = (key: keyof ClassInput, value: string | null) => setForm((old) => ({ ...old, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate({ data: form }, {
      onSuccess: () => {
        setForm({ name: '', grade: '', stream: '', room: '', teacherId: null });
        client.invalidateQueries({ queryKey: getGetOperationsQueryKey() });
        client.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
    });
  };
  const teachers = users.data?.filter((user) => user.role === 'teacher') || [];
  return <Panel className="border-dashed p-5" testId="panel-create-class"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Plus className="size-4" /></span><div><h2 className="font-display text-xl">Create class</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">Create the class record used by attendance and pupil records. Use the exact class name already used on pupil records, then optionally assign a teacher.</p></div></div><span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Admin only</span></div><form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><input required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Class name e.g. Primary 1" className={inputClass} data-testid="input-create-class-name" /><input required value={form.grade} onChange={(event) => update('grade', event.target.value)} placeholder="Grade / level" className={inputClass} data-testid="input-create-class-grade" /><input required value={form.stream} onChange={(event) => update('stream', event.target.value)} placeholder="Stream e.g. Blue" className={inputClass} data-testid="input-create-class-stream" /><input required value={form.room} onChange={(event) => update('room', event.target.value)} placeholder="Room e.g. Block A" className={inputClass} data-testid="input-create-class-room" /><select value={form.teacherId ?? ''} onChange={(event) => update('teacherId', event.target.value || null)} className={inputClass} data-testid="select-create-class-teacher"><option value="">No teacher assigned</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.identifier}</option>)}</select><div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[hsl(var(--muted-foreground))]">A teacher can be selected on multiple class records.</p><Button type="submit" disabled={create.isPending} testId="button-create-class">{create.isPending ? 'Creating…' : 'Create class'}</Button></div></form>{create.isError && <p className="mt-3 text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="status-create-class-error">Class could not be created. Check the name, teacher, and required details.</p>}</Panel>;
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
   return <Panel className="p-5" testId="panel-teacher-assignments"><h2 className="font-display text-xl">Teacher class assignments</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Choose one or more classes for each teacher. A teacher can be assigned to multiple class records, and changes apply to attendance and assignments.</p><div className="mt-5 space-y-4">{teachers.map((teacher) => <div key={teacher.id} className="rounded-2xl border border-[hsl(var(--border))] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">{teacher.name}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{teacher.identifier}</p></div><span className="text-[11px] text-[hsl(var(--primary))]">{teacher.assignedClasses?.length || 0} assigned</span></div><label className="mt-3 block text-xs font-semibold text-[hsl(var(--muted-foreground))]">Assigned classes<select multiple value={teacher.assignedClasses || []} onChange={(event) => save(teacher, Array.from(event.target.selectedOptions, (option) => option.value))} className={`${inputClass} mt-2 h-auto min-h-24 py-2`} data-testid={`select-teacher-classes-${teacher.id}`}>{classes.map((item) => <option key={item.id} value={item.name}>{item.name}{item.stream ? ` · ${item.stream}` : ''}</option>)}</select></label>{!classes.length && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Create a class before assigning it to a teacher.</p>}</div>)}</div>{!teachers.length && <EmptyState icon={Users} title="No teachers yet" description="Create a teacher account to assign classes." />}</Panel>;
}

function ExpenseComposer() {
  const client = useQueryClient();
  const create = useCreateExpense();
  const salaryCreate = useCreateSalaryPayment();
  const salaryStaff = useListSalaryStaff();
  const [salaryStaffId, setSalaryStaffId] = useState('');
  const [salaryPeriod, setSalaryPeriod] = useState('');
  const [salaryMethod, setSalaryMethod] = useState('Bank transfer');
  const [customCategory, setCustomCategory] = useState(false);
  const [form, setForm] = useState<ExpenseInput>({ category: '', description: '', amount: 0, date: new Date().toISOString().slice(0, 10), reference: '' });
  const isSalaryCategory = salaryExpenseCategories.includes(form.category as typeof salaryExpenseCategories[number]);
  const availableSalaryStaff = salaryStaff.data?.filter((staff) => form.category === "Teachers' salaries" ? staff.role.toLowerCase() === 'teacher' : staff.role.toLowerCase() !== 'teacher') || [];
  const update = (key: keyof ExpenseInput, value: string) => setForm((old) => ({ ...old, [key]: key === 'amount' ? Number(value) : value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSalaryCategory) {
      salaryCreate.mutate({ data: { staffId: salaryStaffId, period: salaryPeriod, amount: form.amount, method: salaryMethod, reference: form.reference || '' } }, {
        onSuccess: () => {
          trackEvent('salary_payment_recorded', { payment_method: salaryMethod });
          setForm({ category: '', description: '', amount: 0, date: new Date().toISOString().slice(0, 10), reference: '' });
          setSalaryStaffId('');
          setSalaryPeriod('');
          setCustomCategory(false);
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
        setCustomCategory(false);
        client.invalidateQueries({ queryKey: getGetOperationsQueryKey() });
      },
    });
  };
  return <Panel className="border-dashed p-5" testId="panel-create-expense"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">School Expenses</p><h2 className="mt-1 font-display text-xl">Record a school expense</h2><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Choose a category from the school expense register. Salary categories open the correct teacher or non-teaching staff payment workflow.</p></div><form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-4"><select required value={customCategory ? customExpenseCategory : form.category} onChange={(event) => { const value = event.target.value; const isCustom = value === customExpenseCategory; setCustomCategory(isCustom); setSalaryStaffId(''); setSalaryPeriod(''); update('category', isCustom ? '' : value); }} className={inputClass} data-testid="select-expense-category"><option value="" disabled>Choose expense category</option>{expenseCategoryGroups.map((group) => <optgroup key={group.label} label={group.label}>{group.options.map((option) => <option key={option} value={option}>{option}</option>)}</optgroup>)}<option value={customExpenseCategory}>Custom expense category</option></select>{customCategory && <input required value={form.category} onChange={(event) => update('category', event.target.value)} placeholder="Enter custom expense category" className={inputClass} data-testid="input-expense-category" />}{isSalaryCategory && <><select required value={salaryStaffId} onChange={(event) => { const id = event.target.value; const staff = availableSalaryStaff.find((item) => item.id === id); setSalaryStaffId(id); setForm((old) => ({ ...old, amount: staff?.monthlySalary || 0, description: staff ? `Salary payment for ${staff.name}` : '' })); }} className={inputClass} data-testid="select-expense-salary-staff"><option value="" disabled>{form.category === "Teachers' salaries" ? 'Choose teacher' : 'Choose non-teaching staff member'}</option>{availableSalaryStaff.map((staff) => <option key={staff.id} value={staff.id}>{staff.name} · {staff.role} · {money(staff.monthlySalary)}</option>)}</select><input required value={salaryPeriod} onChange={(event) => setSalaryPeriod(event.target.value)} placeholder="Salary period e.g. Sep 2026" className={inputClass} data-testid="input-expense-salary-period" /><select value={salaryMethod} onChange={(event) => setSalaryMethod(event.target.value)} className={inputClass} data-testid="select-expense-salary-method"><option>Bank transfer</option><option>Mobile money</option><option>Cash</option></select></>}<input required value={form.description} onChange={(event) => update('description', event.target.value)} placeholder={isSalaryCategory ? 'Salary reason' : 'Reason / description'} className={inputClass} data-testid="input-expense-description" /><input required min={1} type="number" value={form.amount || ''} onChange={(event) => update('amount', event.target.value)} placeholder="Amount" className={inputClass} data-testid="input-expense-amount" /><input value={form.reference || ''} onChange={(event) => update('reference', event.target.value)} placeholder="Payment reference (optional)" className={inputClass} data-testid="input-expense-reference" /><input required type="date" value={form.date} onChange={(event) => update('date', event.target.value)} className={inputClass} data-testid="input-expense-date" /><div className="md:col-span-3 flex justify-end"><Button type="submit" disabled={create.isPending || salaryCreate.isPending} testId="button-create-expense">{create.isPending || salaryCreate.isPending ? 'Saving…' : isSalaryCategory ? 'Pay salary & issue receipt' : 'Save expense'}</Button></div></form>{(create.isError || salaryCreate.isError) && <p className="mt-3 text-sm text-[hsl(var(--destructive))]">{isSalaryCategory ? 'Salary payment could not be recorded. Check the registered salary balance and selected staff member.' : 'Expense could not be saved.'}</p>}</Panel>;
}

export function ExpenseCreatePage() {
  return <AppShell><Link href="/expenses" className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))] hover:underline"><ArrowRight className="size-4 rotate-180" /> Back to expenses</Link><PageHeader eyebrow="Finance" title="Record a school expense" description="Capture the category, reason, amount, date, and payment reference for a complete school expense record." /><ExpenseComposer /></AppShell>;
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
         client.invalidateQueries({ queryKey: getListUsersQueryKey() });
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
  const [actionError, setActionError] = useState('');
  const refresh = () => client.invalidateQueries({ queryKey: getGetOperationsQueryKey() });
  if (!rows.length) return <EmptyState icon={Archive} title={`No ${view} to show`} description="This record is empty. Add the first entry when your school is ready." />;
  const preferredColumns: Record<ViewKey, string[]> = {
    people: ['name', 'role', 'phone', 'status', 'children'], classes: ['name', 'teacherName', 'pupilCount', 'room'], subjects: ['name', 'className', 'teacherName', 'status'], assignments: ['title', 'subject', 'className', 'dueDate', 'status'],
    staff: ['name', 'role', 'phone', 'status'], parents: ['name', 'phone', 'children'], expenses: ['category', 'description', 'amount', 'date', 'reference', 'status', 'approvedBy', 'approvedAt'], salaries: ['staffName', 'period', 'amount', 'paymentDate', 'method', 'status'],
    discipline: ['studentName', 'className', 'incident', 'level', 'date'], medical: ['studentName', 'className', 'condition', 'notes', 'lastUpdated'], library: ['title', 'author', 'copiesAvailable', 'status'],
    transport: ['route', 'driver', 'vehicle', 'students', 'status'], inventory: ['item', 'category', 'quantity', 'reorderLevel', 'status'], events: ['title', 'date', 'type', 'location', 'status'],
    documents: ['name', 'type', 'updatedAt', 'visibility'], reports: ['title', 'description', 'period', 'status'], notifications: ['title', 'body', 'date', 'read'],
  };
  const columns = preferredColumns[view].filter((column) => rows.some((row) => row[column] !== undefined));
  return <div>{actionError && <p className="border-b border-[hsl(var(--destructive)/.2)] bg-[hsl(var(--destructive)/.06)] px-5 py-3 text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="status-expense-action-error">{actionError}</p>}<div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)]"><tr>{columns.map((column) => <th key={column} className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{pretty(column)}</th>)}{(view === 'classes' || view === 'expenses') && <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Actions</th>}</tr></thead><tbody className="divide-y divide-[hsl(var(--border))]">{rows.map((row, index) => <tr key={String(row.id || index)} className="transition-colors hover:bg-[hsl(var(--muted)/.35)]" data-testid={`row-operation-${view}-${row.id || index}`}>{columns.map((column) => <td key={column} className={`max-w-[260px] px-5 py-4 text-sm ${column === 'status' ? 'font-semibold' : ''} ${column === 'description' || column === 'notes' || column === 'body' ? 'text-[hsl(var(--muted-foreground))]' : ''}`}>{column === 'amount' ? money(row[column], currency) : (column === 'status' && typeof row[column] === 'string' ? String(row[column]) : compactValue(row[column]))}</td>)}{view === 'classes' && <td className="px-5 py-5"><span className="flex items-center gap-3 whitespace-nowrap"><Link href={`/attendance?className=${encodeURIComponent(String(row.name))}`} className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline">Attendance</Link><Link href="/operations?view=assignments" className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline">Assignments</Link></span></td>}{view === 'expenses' && <td className="px-5 py-5"><div className="flex flex-wrap gap-2">{canApprove && row.status !== 'Approved' && <button className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline" disabled={approve.isPending} onClick={() => { setActionError(''); approve.mutate({ expenseId: String(row.id) }, { onSuccess: refresh, onError: () => setActionError('This expense could not be approved. Refresh the list and try again.') }); }} data-testid={`button-approve-expense-${row.id}`}>{approve.isPending ? 'Approving…' : 'Approve'}</button>}{canDelete && <button className="text-xs font-semibold text-[hsl(var(--destructive))] hover:underline" disabled={remove.isPending} onClick={() => { if (window.confirm('Delete this expense record?')) { setActionError(''); remove.mutate({ expenseId: String(row.id) }, { onSuccess: refresh, onError: () => setActionError('This expense could not be deleted. Refresh the list and try again.') }); } }} data-testid={`button-delete-expense-${row.id}`}>{remove.isPending ? 'Deleting…' : 'Delete'}</button>}{!canApprove && !canDelete && <span className="text-xs text-[hsl(var(--muted-foreground))]">View only</span>}</div></td>}</tr>)}</tbody></table></div></div>;
}

function SubjectCreatePanel() {
  const client = useQueryClient();
  const operations = useGetOperations();
  const classes = operations.data?.modules.classes || [];
  const teachers = (operations.data?.modules.staff || []).filter((item) => item.role === 'teacher');
  const subjects = operations.data?.modules.subjects || [];
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedClassName = className.trim();
    const trimmedTeacherName = teacherName.trim();
    setError('');
    setSaved(false);
    if (!trimmedName || !trimmedClassName) {
      setError('Enter a subject name and choose the class that will study it.');
      return;
    }
    if (subjects.some((item) => item.name.trim().toLowerCase() === trimmedName.toLowerCase() && item.className.trim().toLowerCase() === trimmedClassName.toLowerCase())) {
      setError('That subject already exists for this class. Choose another subject or class.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/operations/subjects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmedName, className: trimmedClassName, teacherName: trimmedTeacherName }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Subject could not be created');
      setName('');
      setTeacherName('');
      setSaved(true);
      await client.invalidateQueries({ queryKey: getGetOperationsQueryKey() });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Subject could not be created. Check the subject and class, then try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return <Panel className="p-6" testId="panel-create-subject"><div className="mb-5"><p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Curriculum setup</p><h2 className="mt-1 font-display text-2xl">Create subject</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Create a subject and attach it to the exact class that will study it. The class is required so attendance, assignments, and reports stay aligned.</p></div><form onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"><label className="space-y-1.5"><span className="text-xs font-semibold">Subject name <span className="text-[hsl(var(--destructive))]">*</span></span><input required value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} placeholder="Mathematics" className={inputClass} data-testid="input-subject-name" /></label><label className="space-y-1.5"><span className="text-xs font-semibold">Specific class <span className="text-[hsl(var(--destructive))]">*</span></span><select required value={className} onChange={(event) => { setClassName(event.target.value); setSaved(false); }} className={inputClass} data-testid="select-subject-class"><option value="">Choose a class</option>{classes.map((item) => <option key={item.id} value={item.name}>{item.name}{item.stream ? ` · ${item.stream}` : ''}</option>)}</select></label><label className="space-y-1.5"><span className="space-x-1 text-xs font-semibold">Teacher <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></span>{teachers.length ? <select value={teacherName} onChange={(event) => setTeacherName(event.target.value)} className={inputClass} data-testid="select-subject-teacher"><option value="">No teacher assigned</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.name}>{teacher.name}</option>)}</select> : <input value={teacherName} onChange={(event) => setTeacherName(event.target.value)} placeholder="No teachers registered yet" className={inputClass} data-testid="input-subject-teacher" />}</label><Button type="submit" disabled={isSubmitting || operations.isLoading || !classes.length} testId="button-create-subject"><Plus className="size-4" /> {isSubmitting ? 'Creating…' : 'Create subject'}</Button></form>{!operations.isLoading && !classes.length && <p className="mt-4 rounded-xl bg-[hsl(var(--muted)/.55)] p-3 text-sm text-[hsl(var(--muted-foreground))]" role="status">Create a class first, then return here to attach subjects to it.</p>}{error && <p className="mt-4 text-sm text-[hsl(var(--destructive))]" role="alert">{error}</p>}{saved && <p className="mt-4 text-sm text-[hsl(var(--primary))]" role="status">Subject created successfully for {className}.</p>}</Panel>;
}

type AccountFormState = {
  name: string;
  identifier: string;
  password: string;
  role: string;
  studentId: string;
  email: string;
  phone: string;
  address: string;
  nextOfKin: string;
  hireDate: string;
  employmentType: string;
  monthlySalary: string;
  permissions: PermissionKey[];
  assignedClasses: string[];
};

const emptyAccountForm: AccountFormState = {
  name: '',
  identifier: '',
  password: '',
  role: 'staff',
  studentId: '',
  email: '',
  phone: '',
  address: '',
  nextOfKin: '',
  hireDate: '',
  employmentType: 'Full-time',
  monthlySalary: '',
  permissions: [],
  assignedClasses: [],
};

function AccountConfirmation({ account, onAgain, onBack }: { account: AuthUser; onAgain: () => void; onBack: () => void }) {
  const registrationForm = account.registrationForm;
  return <Panel className="overflow-hidden border-[hsl(var(--primary)/.3)]" testId="panel-account-creation-confirmation">
    <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.55)] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Check className="size-5" /></span>
        <div><p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Account saved</p><h2 className="mt-1 font-display text-2xl">Access is ready</h2><p className="mt-1 text-sm leading-6 text-[hsl(var(--muted-foreground))]">The account is now available in Users & Roles. Keep the username and temporary password with the staff member securely.</p></div>
      </div>
    </div>
    <dl className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
      <div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Full name</dt><dd className="mt-1 text-sm font-semibold">{account.name}</dd></div>
      <div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Role</dt><dd className="mt-1 text-sm font-semibold capitalize">{account.role.replace('_', ' ')}</dd></div>
      <div className="rounded-2xl bg-[hsl(var(--primary)/.08)] p-4"><dt className="text-xs text-[hsl(var(--muted-foreground))]">Username</dt><dd className="mt-1 font-mono-ui text-base font-semibold text-[hsl(var(--primary))]" data-testid="text-created-account-username">{account.identifier}</dd></div>
      <div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Contact</dt><dd className="mt-1 text-sm font-semibold">{account.phone || account.email || 'No contact supplied'}</dd></div>
      {registrationForm && <div className="sm:col-span-2 rounded-2xl border border-dashed border-[hsl(var(--border))] p-4"><p className="text-xs font-semibold text-[hsl(var(--primary))]">Teacher registration record</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Assigned classes: <span className="font-semibold text-[hsl(var(--foreground))]">{registrationForm.assignedClasses.join(', ') || 'None'}</span></p><div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => void downloadTeacherRegistration(registrationForm)} testId="button-download-created-teacher-form"><Download className="size-4" /> Download PDF</Button><Button variant="secondary" onClick={() => printTeacherRegistration(registrationForm)} testId="button-print-created-teacher-form"><Printer className="size-4" /> Print registration</Button></div></div>}
    </dl>
    <div className="flex flex-wrap justify-end gap-3 border-t border-[hsl(var(--border))] p-5 sm:p-6"><Button variant="secondary" onClick={onBack} testId="button-return-users-after-create">Return to Users & Roles</Button><Button onClick={onAgain} testId="button-register-another-account"><Plus className="size-4" /> Register another account</Button></div>
  </Panel>;
}

function CreateAccountPanelEnhanced({ onBack }: { onBack: () => void }) {
  const client = useQueryClient();
  const create = useCreateUser();
  const operations = useGetOperations();
  const [form, setForm] = useState<AccountFormState>(emptyAccountForm);
  const [showDetails, setShowDetails] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [createdAccount, setCreatedAccount] = useState<AuthUser | null>(null);
  const update = (key: keyof AccountFormState, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const classRows = operations.data?.modules?.classes || [];
  const permissionOptions: { key: PermissionKey; label: string }[] = [
    { key: 'expense_approve', label: 'Approve expenses' },
    { key: 'expense_delete', label: 'Delete expenses' },
    { key: 'transactions_view', label: 'View transactions' },
    { key: 'transactions_print', label: 'Print/download/share receipts' },
    { key: 'finance_view', label: 'Access finance & payments' },
    { key: 'expenses_view', label: 'Access expenses' },
    { key: 'manage_users', label: 'Manage users and roles' },
  ];
  const reset = () => {
    setForm(emptyAccountForm);
    setAssignmentError('');
    setShowDetails(false);
    setShowPermissions(false);
    setCreatedAccount(null);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (form.role === 'teacher' && form.assignedClasses.length === 0) {
      setAssignmentError('Assign at least one class before registering a teacher.');
      setShowDetails(true);
      return;
    }
    setAssignmentError('');
    const data: UserAccountInput = {
      name: form.name.trim(),
      identifier: form.identifier.trim(),
      password: form.password,
      role: form.role as UserAccountInput['role'],
      userType: form.role === 'student' || form.role === 'guardian' ? 'learner' : 'staff',
      studentId: form.role === 'guardian' || form.role === 'student' ? form.studentId.trim() : null,
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      nextOfKin: form.nextOfKin.trim(),
      hireDate: form.hireDate,
      employmentType: form.employmentType,
      monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : undefined,
      permissions: form.permissions,
      assignedClasses: form.role === 'teacher' ? form.assignedClasses : [],
    };
    create.mutate({ data }, {
      onSuccess: (account) => {
        trackEvent('account_created', { role: data.role, user_type: data.userType });
        setCreatedAccount(account);
        client.invalidateQueries({ queryKey: getGetOperationsQueryKey() });
        client.invalidateQueries({ queryKey: getListUsersQueryKey() });
        client.invalidateQueries({ queryKey: getListSalaryStaffQueryKey() });
      },
    });
  };
  if (createdAccount) return <AccountConfirmation account={createdAccount} onAgain={reset} onBack={onBack} />;
  return <Panel className="border-dashed p-5 sm:p-6" testId="panel-create-account">
    <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><KeyRound className="size-5" /></span><div><p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--primary))]">New access</p><h2 className="mt-1 font-display text-2xl">Create user account</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Start with the sign-in details. Add employment information, class assignments, and action permissions only when they apply.</p></div></div>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">Full name<input required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Full names" className={`${inputClass} mt-1`} data-testid="input-account-name" /></label>
        <label className="text-xs font-semibold">Username or identifier<input required value={form.identifier} onChange={(event) => update('identifier', event.target.value)} placeholder={form.role === 'student' ? 'Permanent registration number' : 'Username'} className={`${inputClass} mt-1`} data-testid="input-account-identifier" /></label>
        <label className="text-xs font-semibold">Account role<select value={form.role} onChange={(event) => { const role = event.target.value; setForm((old) => ({ ...old, role, assignedClasses: role === 'teacher' ? old.assignedClasses : [] })); setAssignmentError(''); }} className={`${inputClass} mt-1`} data-testid="select-account-role">{['teacher', 'accountant', 'staff', 'guardian', 'student'].map((role) => <option key={role} value={role}>{role === 'student' ? 'Pupil' : role[0].toUpperCase() + role.slice(1)}</option>)}</select></label>
        <label className="text-xs font-semibold">Temporary password<input required minLength={8} type="password" value={form.password} onChange={(event) => update('password', event.target.value)} placeholder="At least 8 characters" className={`${inputClass} mt-1`} data-testid="input-account-password" /></label>
      </div>
      {(form.role === 'guardian' || form.role === 'student') && <label className="block text-xs font-semibold">Linked pupil ID or registration number<input required value={form.studentId} onChange={(event) => update('studentId', event.target.value)} placeholder="Paste the pupil ID or registration number" className={`${inputClass} mt-1`} data-testid="input-account-student-id" /></label>}
      {(form.role === 'teacher' || form.role === 'staff') && <label className="block text-xs font-semibold">Monthly salary (UGX)<input required min={0} type="number" value={form.monthlySalary} onChange={(event) => update('monthlySalary', event.target.value)} placeholder="0" className={`${inputClass} mt-1`} data-testid="input-account-monthly-salary" /></label>}
      <button type="button" onClick={() => setShowDetails((open) => !open)} className="flex w-full items-center justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)] px-4 py-3 text-left text-sm font-semibold hover:bg-[hsl(var(--secondary)/.55)]" aria-expanded={showDetails} data-testid="button-toggle-account-details"><span>Contact and employment details <span className="ml-1 text-xs font-normal text-[hsl(var(--muted-foreground))]">Optional</span></span><ArrowRight className={`size-4 transition-transform ${showDetails ? 'rotate-90' : ''}`} /></button>
      {showDetails && <div className="grid gap-4 rounded-2xl border border-[hsl(var(--border))] p-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">Phone<input type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Contact number" className={`${inputClass} mt-1`} data-testid="input-account-phone" /></label>
        <label className="text-xs font-semibold">Email<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="Email address" className={`${inputClass} mt-1`} data-testid="input-account-email" /></label>
        <label className="text-xs font-semibold">Home address<input value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Home address" className={`${inputClass} mt-1`} data-testid="input-account-address" /></label>
        <label className="text-xs font-semibold">Next of kin<input value={form.nextOfKin} onChange={(event) => update('nextOfKin', event.target.value)} placeholder="Emergency contact" className={`${inputClass} mt-1`} data-testid="input-account-next-of-kin" /></label>
        <label className="text-xs font-semibold">Hire date<input type="date" value={form.hireDate} onChange={(event) => update('hireDate', event.target.value)} className={`${inputClass} mt-1`} data-testid="input-account-hire-date" /></label>
        <label className="text-xs font-semibold">Employment type<select value={form.employmentType} onChange={(event) => update('employmentType', event.target.value)} className={`${inputClass} mt-1`} data-testid="select-account-employment-type"><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Volunteer</option></select></label>
      </div>}
      {form.role === 'teacher' && <fieldset className={`rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)] p-4 ${assignmentError ? 'border-[hsl(var(--destructive)/.55)]' : ''}`}><legend className="px-1 text-xs font-semibold">Assigned classes <span className="text-[hsl(var(--destructive))]">*</span></legend><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Choose every class this teacher can work with. The exact saved class name is retained.</p><select required multiple value={form.assignedClasses} onChange={(event) => { setForm((old) => ({ ...old, assignedClasses: Array.from(event.target.selectedOptions, (option) => option.value) })); setAssignmentError(''); }} className={`${inputClass} mt-3 h-auto min-h-28 py-2`} data-testid="select-account-classes">{classRows.map((item) => <option key={item.id} value={item.name}>{item.name}{item.stream ? ` · ${item.stream}` : ''}</option>)}</select>{!classRows.length && <p className="mt-2 text-xs text-[hsl(var(--destructive))]">Create at least one class before registering a teacher.</p>}{assignmentError && <p className="mt-2 text-xs text-[hsl(var(--destructive))]" role="alert" data-testid="status-account-class-error">{assignmentError}</p>}</fieldset>}
      <button type="button" onClick={() => setShowPermissions((open) => !open)} className="flex w-full items-center justify-between rounded-2xl border border-[hsl(var(--border))] px-4 py-3 text-left text-sm font-semibold hover:bg-[hsl(var(--muted)/.55)]" aria-expanded={showPermissions} data-testid="button-toggle-account-permissions"><span>Action permissions <span className="ml-1 text-xs font-normal text-[hsl(var(--muted-foreground))]">{form.permissions.length ? `${form.permissions.length} selected` : 'None selected'}</span></span><ArrowRight className={`size-4 transition-transform ${showPermissions ? 'rotate-90' : ''}`} /></button>
      {showPermissions && <div className="grid gap-3 rounded-2xl bg-[hsl(var(--muted)/.55)] p-4 sm:grid-cols-2">{permissionOptions.map((permission) => <label key={permission.key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.permissions.includes(permission.key)} onChange={() => setForm((old) => ({ ...old, permissions: old.permissions.includes(permission.key) ? old.permissions.filter((item) => item !== permission.key) : [...old.permissions, permission.key] }))} />{permission.label}</label>)}</div>}
      {create.isError && <p className="rounded-xl border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.07)] p-3 text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="status-account-error">Account could not be created. Check the identifier, linked pupil, and required details.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--border))] pt-4"><p className="text-xs text-[hsl(var(--muted-foreground))]">The account will appear in the directory after it is saved.</p><Button type="submit" disabled={create.isPending || (form.role === 'teacher' && (!classRows.length || !form.assignedClasses.length))} testId="button-create-account">{create.isPending ? 'Creating account…' : 'Create account'}<ArrowRight className="size-4" /></Button></div>
    </form>
  </Panel>;
}

function UsersRolesDirectory({ createMode, onBack }: { createMode: boolean; onBack: () => void }) {
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const users = useListUsers();
  const update = useUpdateUserProfileByAdmin();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [form, setForm] = useState({ name: '', identifier: '', email: '', phone: '', newPassword: '' });
  const allStaffUsers = (users.data || []).filter((user) => ['super_admin', 'administrator', 'teacher', 'accountant', 'staff'].includes(user.role));
  const staffUsers = allStaffUsers.filter((user) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [user.name, user.identifier, user.email, user.phone].some((value) => value.toLowerCase().includes(term));
    return matchesSearch && (roleFilter === 'all' || user.role === roleFilter);
  });
  const selectedUser = allStaffUsers.find((user) => user.id === selectedId);
  const chooseUser = (user: AuthUser) => {
    setSelectedId(user.id);
    setSaved(false);
    setForm({ name: user.name, identifier: user.identifier, email: user.email, phone: user.phone, newPassword: '' });
  };
  const updateField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser) return;
    const data: UserAdminProfileUpdate = { name: form.name.trim(), identifier: form.identifier.trim(), email: form.email.trim(), phone: form.phone.trim(), ...(form.newPassword.trim() ? { newPassword: form.newPassword } : {}) };
    setSaved(false);
    update.mutate({ userId: selectedUser.id, data }, {
      onSuccess: (updated) => {
        setForm({ name: updated.name, identifier: updated.identifier, email: updated.email, phone: updated.phone, newPassword: '' });
        setSaved(true);
        client.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
    });
  };
  if (createMode) return <div className="space-y-4"><Button variant="quiet" onClick={onBack} testId="button-back-to-users"><ArrowRight className="size-4 rotate-180" /> Back to Users & Roles</Button><CreateAccountPanelEnhanced onBack={onBack} /></div>;
  const roleOptions = Array.from(new Set(allStaffUsers.map((user) => user.role)));
  return <div className="space-y-6">
    <Panel className="overflow-hidden" testId="panel-registered-staff">
      <div className="border-b border-[hsl(var(--border))] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Access directory</p>
            <h2 className="mt-1 font-display text-2xl">Users & Roles</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Search staff accounts, confirm their sign-in details, and update access without losing usernames or role assignments.</p>
          </div>
          <Link href="/operations?view=people&mode=create" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:brightness-110 focus-ring" data-testid="button-create-new-staff">
            <Plus className="size-4" /> Create new staff
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[hsl(var(--secondary)/.65)] p-3"><p className="text-xs text-[hsl(var(--muted-foreground))]">Staff accounts</p><p className="mt-1 font-display text-2xl">{allStaffUsers.length}</p></div>
          <div className="rounded-2xl bg-[hsl(var(--secondary)/.65)] p-3"><p className="text-xs text-[hsl(var(--muted-foreground))]">Teachers</p><p className="mt-1 font-display text-2xl">{allStaffUsers.filter((user) => user.role === 'teacher').length}</p></div>
          <div className="rounded-2xl bg-[hsl(var(--secondary)/.65)] p-3"><p className="text-xs text-[hsl(var(--muted-foreground))]">Showing</p><p className="mt-1 font-display text-2xl">{staffUsers.length}</p></div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-[hsl(var(--muted-foreground))]" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, username, email, or phone" className={`${inputClass} pl-9`} aria-label="Search staff accounts" data-testid="input-search-staff" /></label>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={`${inputClass} sm:w-44`} aria-label="Filter staff by role" data-testid="select-staff-role-filter"><option value="all">All roles</option>{roleOptions.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}</select>
        </div>
      </div>
      {users.isLoading ? <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div> : users.isError ? <div className="p-5"><ErrorState onRetry={() => users.refetch()} message="Registered staff accounts could not be loaded." /></div> : !staffUsers.length ? <div className="p-5"><EmptyState icon={Users} title={allStaffUsers.length ? 'No matching staff accounts' : 'No staff accounts yet'} description={allStaffUsers.length ? 'Try a different search or role filter.' : 'Create the first teacher or staff account to start managing school access.'} action={<Button onClick={() => setLocation('/operations?view=people&mode=create')}><Plus className="size-4" /> Create new staff</Button>} /></div> : <div className="divide-y divide-[hsl(var(--border))]">{staffUsers.map((user) => <button type="button" key={user.id} onClick={() => chooseUser(user)} className={`flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-[hsl(var(--muted)/.45)] ${selectedId === user.id ? 'bg-[hsl(var(--secondary)/.5)]' : ''}`} data-testid={`button-staff-user-${user.id}`}><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-sm font-bold text-[hsl(var(--primary))]">{user.initials}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.name}</span><span className="mt-1 block truncate text-xs capitalize text-[hsl(var(--muted-foreground))]">{user.identifier} · {user.role.replace('_', ' ')}</span></span><span className="hidden text-right text-xs text-[hsl(var(--muted-foreground))] sm:block">{user.email || 'No email'}<br />{user.phone || 'No phone'}</span><Pencil className="size-4 shrink-0 text-[hsl(var(--muted-foreground))]" /></button>)}</div>}
    </Panel>
    {selectedUser && <Panel className="p-5 sm:p-6" testId="panel-edit-staff"><div className="flex items-start justify-between gap-3"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Edit account</p><h2 className="mt-1 font-display text-2xl">{selectedUser.name}</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Changes apply to the account used to sign in. Role, class assignments, and permissions remain unchanged here.</p></div><button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Close edit account" data-testid="button-close-edit-staff"><X className="size-4" /></button></div><form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold">Full name<input required value={form.name} onChange={(event) => updateField('name', event.target.value)} className={`${inputClass} mt-1`} data-testid="input-edit-staff-name" /></label><label className="text-xs font-semibold">Username<input required value={form.identifier} onChange={(event) => updateField('identifier', event.target.value)} className={`${inputClass} mt-1`} data-testid="input-edit-staff-username" /></label><label className="text-xs font-semibold">Email<input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} className={`${inputClass} mt-1`} data-testid="input-edit-staff-email" /></label><label className="text-xs font-semibold">Phone number<input type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} className={`${inputClass} mt-1`} data-testid="input-edit-staff-phone" /></label><label className="text-xs font-semibold md:col-span-2">New password <span className="font-normal text-[hsl(var(--muted-foreground))]">(leave blank to keep the current password)</span><input minLength={8} type="password" value={form.newPassword} onChange={(event) => updateField('newPassword', event.target.value)} placeholder="Enter a new password (8+ characters)" className={`${inputClass} mt-1`} data-testid="input-edit-staff-password" /></label><div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">{update.isError && <p className="text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="status-edit-staff-error">This account could not be updated. Check the username and try again.</p>}{saved && <p className="flex items-center gap-1.5 text-sm text-[hsl(var(--primary))]" data-testid="status-edit-staff-saved"><Check className="size-4" /> Account updated</p>}<Button type="submit" disabled={update.isPending} testId="button-save-staff-account">{update.isPending ? 'Saving account…' : 'Save account changes'}<Check className="size-4" /></Button></div></form></Panel>}
  </div>;
}

export function OperationsPage() {
  const [location, setLocation] = useLocation();
  const { data: session } = useGetCurrentUser();
  const query = useGetOperations();
  const role = session?.user.role || query.data?.role || 'staff';
  const baseViews = roleViews[role] || roleViews.staff;
  const isExpensesRoute = location.split('?')[0] === '/expenses';
  const visibleViews = views.filter((item) => (isExpensesRoute ? item.key === 'expenses' : baseViews.includes(item.key) || ((item.key === 'expenses') && session?.user.permissions.includes('expenses_view'))));
  const queryString = location.includes('?') ? location.slice(location.indexOf('?') + 1) : '';
  const queryParams = new URLSearchParams(queryString);
  const requested = queryParams.get('view') as ViewKey | null;
  const createMode = requested === 'people' && queryParams.get('mode') === 'create';
  const view = isExpensesRoute ? 'expenses' : visibleViews.some((item) => item.key === requested) ? requested as ViewKey : visibleViews[0]?.key || 'events';
  const selected = views.find((item) => item.key === view) || views[0];
  const rows = useMemo(() => {
    const moduleRows = view === 'people' ? [...(query.data?.modules?.staff || []), ...(query.data?.modules?.parents || [])] : query.data?.modules?.[view];
    return (moduleRows || []) as unknown as Row[];
  }, [query.data, view]);
  const [expenseFilter, setExpenseFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const expenseRows = useMemo(() => {
    if (view !== 'expenses' || expenseFilter === 'all') return rows;
    return rows.filter((row) => String(row.status || '').toLowerCase() === expenseFilter);
  }, [expenseFilter, rows, view]);
  const expenseTotals = useMemo(() => {
    const total = rows.reduce((sum, row) => sum + (typeof row.amount === 'number' ? row.amount : Number(row.amount || 0)), 0);
    const pending = rows.filter((row) => String(row.status || '').toLowerCase() !== 'approved').length;
    const approvedTotal = rows.filter((row) => String(row.status || '').toLowerCase() === 'approved').reduce((sum, row) => sum + (typeof row.amount === 'number' ? row.amount : Number(row.amount || 0)), 0);
    return { total, pending, approvedTotal };
  }, [rows]);
  const isAdmin = role === 'administrator' || role === 'super_admin';
  const isFinance = isAdmin || role === 'accountant' || session?.user.permissions.includes('expenses_view');
  const availableActions = query.data?.actions || [];
  return <AppShell><PageHeader eyebrow={`${role.replace('_', ' ')} · ${view === 'expenses' ? 'Finance' : view === 'people' ? 'Administration' : 'Operations'}`} title={view === 'expenses' ? 'School Expenses' : view === 'people' ? 'Users & Roles' : 'Operations hub'} description={view === 'expenses' ? 'Record, review, approve, and manage every school expense from one dedicated workspace.' : view === 'people' ? 'Manage registered staff accounts, sign-in details, and permissions from one secure workspace.' : 'Work only with the records and actions available to your role.'} action={<Button variant="secondary" onClick={() => query.refetch()} testId="button-refresh-operations"><RefreshCcw className="size-4" /> Refresh</Button>} />{query.isError ? <Panel><ErrorState onRetry={() => query.refetch()} /></Panel> : query.isLoading ? <OperationsSkeleton /> : <div className="space-y-6">
    {availableActions.length > 0 && <div className="flex flex-wrap gap-2">{availableActions.slice(0, 3).map((action) => <Link href={action.href} key={action.id} className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2 text-xs font-semibold text-[hsl(var(--primary))]" data-testid={`link-operations-action-${action.id}`}>{action.label}<ArrowRight className="size-3.5" /></Link>)}</div>}
       <div className="grid gap-6 lg:grid-cols-[250px_1fr]"><Panel className="h-fit p-2" testId="panel-operations-switcher"><p className="px-3 pb-2 pt-2 font-mono-ui text-[10px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Your work areas</p>{visibleViews.map(({ key, label, icon: Icon }) => { const active = key === view; const count = key === 'people' ? (query.data?.modules?.staff.length || 0) + (query.data?.modules?.parents.length || 0) : (query.data?.modules?.[key] || []).length; return <Link href={`/operations?view=${key}`} key={key} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? 'bg-[hsl(var(--secondary))] font-semibold text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`} data-testid={`link-operation-view-${key}`}><Icon className="size-[17px]" /><span className="flex-1">{label}</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground)/.7)]">{count}</span></Link>; })}</Panel><div className="min-w-0 space-y-6">{view === 'people' ? <UsersRolesDirectory createMode={createMode} onBack={() => setLocation('/operations?view=people')} /> : <>{view === 'expenses' && <div className="grid gap-3 sm:grid-cols-3"><Panel className="p-4" testId="panel-expense-total"><p className="text-xs text-[hsl(var(--muted-foreground))]">All expenses</p><p className="mt-1 font-display text-2xl">{money(expenseTotals.total, query.data?.currencyCode || 'UGX')}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{rows.length} record{rows.length === 1 ? '' : 's'}</p></Panel><Panel className="p-4" testId="panel-expense-approved"><p className="text-xs text-[hsl(var(--muted-foreground))]">Approved spend</p><p className="mt-1 font-display text-2xl">{money(expenseTotals.approvedTotal, query.data?.currencyCode || 'UGX')}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Ready for reporting</p></Panel><Panel className="p-4" testId="panel-expense-pending"><p className="text-xs text-[hsl(var(--muted-foreground))]">Awaiting approval</p><p className="mt-1 font-display text-2xl">{expenseTotals.pending}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Review before closing the period</p></Panel></div>}{view === 'expenses' && <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" testId="panel-expense-filter"><div><p className="text-sm font-semibold">Expense register</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Record new spending, review approvals, and keep the UGX audit trail complete.</p></div><select value={expenseFilter} onChange={(event) => setExpenseFilter(event.target.value as typeof expenseFilter)} className={`${inputClass} sm:w-48`} aria-label="Filter expenses" data-testid="select-expense-filter"><option value="all">All expenses</option><option value="pending">Awaiting approval</option><option value="approved">Approved</option></select></Panel>}<Panel className="overflow-hidden" testId={`panel-operation-view-${view}`}><div className="flex flex-col justify-between gap-3 border-b border-[hsl(var(--border))] p-5 sm:flex-row sm:items-center"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">{query.data?.currencyCode || 'UGX'}</p><h2 className="mt-1 font-display text-2xl">{selected.label}</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{(view === 'expenses' ? expenseRows : rows).length ? `${(view === 'expenses' ? expenseRows : rows).length} record${(view === 'expenses' ? expenseRows : rows).length === 1 ? '' : 's'} available to you` : 'No records have been created yet'}</p></div>{isFinance && view === 'expenses' && <Link href="/finance" className="text-xs font-semibold text-[hsl(var(--primary))]">Open finance <ArrowRight className="ml-1 inline size-3.5" /></Link>}</div><OperationsRows view={view} rows={view === 'expenses' ? expenseRows : rows} currency={query.data?.currencyCode || 'UGX'} canApprove={isAdmin || session?.user.permissions.includes('expense_approve')} canDelete={isAdmin || session?.user.permissions.includes('expense_delete')} /></Panel>
         {isAdmin && view === 'classes' && <CreateClassPanel />}
        {isAdmin && view === 'subjects' && <SubjectCreatePanel />}
          {isAdmin && !createMode && <><UserPermissionsPanel /><TeacherAssignmentPanel /></>}
      {isFinance && view === 'expenses' && <ExpenseComposer />}
      {isFinance && view === 'salaries' && <SalaryComposer />}
       </>}
    </div></div>
  </div>}</AppShell>;
}