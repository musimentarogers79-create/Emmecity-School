import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import type { AttendanceRecord, OperationExpense, Payment, Student } from '@workspace/api-client-react';
import { getGetAttendanceQueryKey, getGetCurrentUserQueryKey, getGetOperationsQueryKey, getListPaymentsQueryKey, getListStudentsQueryKey, useGetAttendance, useGetCurrentUser, useGetOperations, useListPayments, useListStudents, useLogout } from '@workspace/api-client-react';
import { BookOpen, CalendarDays, CircleDollarSign, ClipboardList, Download, FileBarChart, KeyRound, LayoutDashboard, LogOut, Menu, Megaphone, PanelLeftClose, PanelLeftOpen, ReceiptText, Search, Settings, ShieldCheck, UserRound, Users, X } from 'lucide-react';

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
export const SCHOOL_NAME = 'EMMECTY NURSERY & PRIMARY SCHOOL';
export const SCHOOL_POSTAL_ADDRESS = 'P.O. Box 490699, Hoima City';
export const SCHOOL_PHONE = '0784905399 / 0775705175';
export const SCHOOL_LOCATION = 'Kasasa Road behind Kabago Fuel Station';
const roleNavigation: Record<string, NavItem[]> = {
  administrator: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/students', label: 'Pupils', icon: Users },
    { href: '/attendance', label: 'Attendance', icon: CalendarDays },
    { href: '/finance', label: 'Finance', icon: CircleDollarSign },
    { href: '/expenses', label: 'Expenses', icon: ReceiptText },
    { href: '/transactions', label: 'Transactions', icon: ReceiptText },
    { href: '/subjects', label: 'Subjects', icon: BookOpen },
    { href: '/users', label: 'Users & Roles', icon: KeyRound },
    { href: '/announcements', label: 'Announcements', icon: Megaphone },
    { href: '/timetable', label: 'Timetable', icon: BookOpen },
  ],
  super_admin: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/students', label: 'Pupils', icon: Users },
    { href: '/attendance', label: 'Attendance', icon: CalendarDays },
    { href: '/finance', label: 'Finance', icon: CircleDollarSign },
    { href: '/expenses', label: 'Expenses', icon: ReceiptText },
    { href: '/subjects', label: 'Subjects', icon: BookOpen },
    { href: '/users', label: 'Users & Roles', icon: KeyRound },
    { href: '/announcements', label: 'Announcements', icon: Megaphone },
    { href: '/timetable', label: 'Timetable', icon: BookOpen },
  ],
  teacher: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/operations?view=classes', label: 'My classes', icon: Users },
    { href: '/attendance', label: 'Attendance', icon: CalendarDays },
    { href: '/finance', label: 'Finance', icon: CircleDollarSign },
    { href: '/expenses', label: 'Expenses', icon: ReceiptText },
    { href: '/transactions', label: 'Transactions', icon: ReceiptText },
    { href: '/operations?view=assignments', label: 'Assignments', icon: ClipboardList },
    { href: '/subjects', label: 'Subjects', icon: BookOpen },
    { href: '/announcements', label: 'Announcements', icon: Megaphone },
    { href: '/timetable', label: 'Timetable', icon: BookOpen },
  ],
  accountant: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/finance', label: 'Finance', icon: CircleDollarSign },
    { href: '/expenses', label: 'Expenses', icon: ReceiptText },
    { href: '/transactions', label: 'Transactions', icon: ReceiptText },
    { href: '/operations?view=reports', label: 'Reports', icon: FileBarChart },
    { href: '/announcements', label: 'Announcements', icon: Megaphone },
  ],
  guardian: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/students/stu-001', label: 'My child', icon: UserRound },
    { href: '/operations?view=assignments', label: 'Assignments', icon: ClipboardList },
    { href: '/timetable', label: 'Timetable', icon: BookOpen },
    { href: '/students/stu-001', label: 'Report card', icon: FileBarChart },
    { href: '/announcements', label: 'Announcements', icon: Megaphone },
    { href: '/operations?view=library', label: 'Library', icon: BookOpen },
    { href: '/operations?view=transport', label: 'Transport', icon: ReceiptText },
    { href: '/operations?view=notifications', label: 'Notifications', icon: ClipboardList },
  ],
  student: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/students/stu-001', label: 'My learning', icon: UserRound },
    { href: '/operations?view=assignments', label: 'Assignments', icon: ClipboardList },
    { href: '/timetable', label: 'Timetable', icon: BookOpen },
    { href: '/students/stu-001', label: 'Report card', icon: FileBarChart },
    { href: '/announcements', label: 'Announcements', icon: Megaphone },
    { href: '/operations?view=library', label: 'Library', icon: BookOpen },
    { href: '/operations?view=transport', label: 'Transport', icon: ReceiptText },
    { href: '/operations?view=notifications', label: 'Notifications', icon: ClipboardList },
  ],
  secretary: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/operations?view=events', label: 'Events', icon: CalendarDays },
    { href: '/operations?view=documents', label: 'Documents', icon: FileBarChart },
    { href: '/operations?view=notifications', label: 'Notifications', icon: ClipboardList },
    { href: '/timetable', label: 'Timetable', icon: BookOpen },
  ],
  librarian: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/operations?view=library', label: 'Library', icon: BookOpen },
    { href: '/operations?view=events', label: 'Events', icon: CalendarDays },
    { href: '/operations?view=notifications', label: 'Notifications', icon: ClipboardList },
    { href: '/timetable', label: 'Timetable', icon: BookOpen },
  ],
  nurse: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/operations?view=medical', label: 'Medical', icon: ShieldCheck },
    { href: '/operations?view=events', label: 'Events', icon: CalendarDays },
    { href: '/operations?view=notifications', label: 'Notifications', icon: ClipboardList },
    { href: '/timetable', label: 'Timetable', icon: BookOpen },
  ],
  staff: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/finance', label: 'Finance', icon: CircleDollarSign },
    { href: '/expenses', label: 'Expenses', icon: ReceiptText },
    { href: '/transactions', label: 'Transactions', icon: ReceiptText },
    { href: '/operations?view=events', label: 'Events', icon: CalendarDays },
    { href: '/operations?view=documents', label: 'Documents', icon: FileBarChart },
    { href: '/operations?view=notifications', label: 'Notifications', icon: ClipboardList },
    { href: '/timetable', label: 'Timetable', icon: BookOpen },
  ],
};

function Initials({ name, className = '' }: { name: string; className?: string }) {
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'EN';
  return <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-xs font-bold text-[hsl(var(--accent-foreground))] ${className}`} data-testid="avatar-user">{initials}</span>;
}

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const supportedPupilClasses = ['Baby Class', 'Middle Class', 'Top Class', 'Daycare', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Primary 7'];
function downloadCsv(filename: string, columns: string[], rows: unknown[][]) {
  const csv = [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const htmlCell = (value: unknown) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function downloadTable(filename: string, columns: string[], rows: unknown[][], format: 'doc' | 'xls' | 'pdf') {
  if (format === 'pdf') {
    const lines = [columns.join(' | '), ...rows.map((row) => row.map((value) => String(value ?? '')).join(' | '))].slice(0, 48);
    const stream = ['BT', '/F1 9 Tf', '40 760 Td', ...lines.map((line, index) => `${index ? '0 -14 Td ' : ''}(${line.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')}) Tj`), 'ET'].join('\n');
    const objects = [`<< /Type /Catalog /Pages 2 0 R >>`, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename.replace(/\.[^.]+$/, '') + '.pdf'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); return;
  }
  const table = `<table border="1"><thead><tr>${columns.map((column) => `<th>${htmlCell(column)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${htmlCell(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const url = URL.createObjectURL(new Blob([`<html><head><meta charset="utf-8"></head><body><h2>${htmlCell(filename)}</h2>${table}</body></html>`], { type: format === 'doc' ? 'application/msword' : 'application/vnd.ms-excel' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename.replace(/\.[^.]+$/, '') + (format === 'doc' ? '.doc' : '.xls'); anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function FormatDownloadButtons({ filename, columns, rows, disabled, testId }: { filename: string; columns: string[]; rows: unknown[][]; disabled?: boolean; testId: string }) {
  return <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => downloadTable(filename, columns, rows, 'doc')} disabled={disabled} testId={`${testId}-doc`}><Download className="size-3.5" /> DOC</Button><Button variant="secondary" onClick={() => downloadTable(filename, columns, rows, 'xls')} disabled={disabled} testId={`${testId}-excel`}><Download className="size-3.5" /> Excel</Button><Button variant="secondary" onClick={() => downloadTable(filename, columns, rows, 'pdf')} disabled={disabled} testId={`${testId}-pdf`}><Download className="size-3.5" /> PDF</Button></div>;
}

function PupilExportToolbar() {
  const [location] = useLocation();
  const { data: session } = useGetCurrentUser();
  const students = useListStudents({}, { query: { enabled: location === '/students', queryKey: getListStudentsQueryKey({}) } });
  const payments = useListPayments({ query: { enabled: location === '/students', queryKey: getListPaymentsQueryKey() } });
  const [classFilter, setClassFilter] = useState('All classes');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const canExport = session?.user.role === 'administrator' || session?.user.role === 'super_admin';
  if (location !== '/students' || !canExport) return null;
  const classOptions = Array.from(new Set([...supportedPupilClasses, ...(students.data || []).map((student) => student.className).filter(Boolean)]));
  const paymentRows = payments.data || [];
  const paidByStudent = new Map<string, number>();
  paymentRows.forEach((payment: Payment) => paidByStudent.set(payment.studentId, (paidByStudent.get(payment.studentId) || 0) + payment.amount));
  const filtered = (students.data || []).filter((student: Student) => {
    if (classFilter !== 'All classes' && student.className !== classFilter) return false;
    const paid = paidByStudent.get(student.id) ?? student.amountPaid ?? 0;
    const termFee = student.termFee || 0;
    if (paymentFilter === 'paid') return student.feeBalance <= 0;
    if (paymentFilter === 'half') return termFee > 0 && paid >= termFee / 2 && paid < termFee;
    if (paymentFilter === 'unpaid') return paid <= 0;
    return true;
  });
  const pupilColumns = ['Registration number', 'Pupil name', 'Class', 'Stream', 'Gender', 'Guardian', 'Guardian phone', 'Previous balance (UGX)', 'Term fee (UGX)', 'Paid (UGX)', 'Total balance (UGX)', 'Status'];
  const pupilRows = filtered.map((student) => {
    const paid = paidByStudent.get(student.id) ?? student.amountPaid ?? 0;
    const pupil = student as Student & { guardianName?: string; guardianPhone?: string };
    return [pupil.registrationNumber, pupil.name, pupil.className, pupil.stream, pupil.gender, pupil.guardianName || 'N/A', pupil.guardianPhone || 'N/A', pupil.previousFeeBalance, pupil.termFee, paid, pupil.feeBalance, pupil.status];
  });
  const exportPupils = () => downloadCsv(`pupils-${classFilter === 'All classes' ? 'all-classes' : classFilter.replaceAll(' ', '-').toLowerCase()}-${paymentFilter}.csv`, pupilColumns, pupilRows);
  return <Panel className="mb-6 border-[hsl(var(--primary)/.25)] bg-[hsl(var(--secondary)/.2)] p-4" testId="panel-pupil-downloads"><div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Pupil downloads</p><h2 className="mt-1 font-display text-xl">Download pupil lists</h2><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Choose all classes or one class, then filter by payment status before downloading.</p></div><div className="grid gap-3 sm:grid-cols-3 xl:min-w-[650px]"><label className="text-xs font-semibold">Class<select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm" data-testid="select-pupil-download-class"><option>All classes</option>{classOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label className="text-xs font-semibold">Payment status<select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm" data-testid="select-pupil-download-payment"><option value="all">All pupils</option><option value="paid">Paid in full</option><option value="half">Paid half / part paid</option><option value="unpaid">Not paid</option></select></label><div className="flex flex-wrap items-end gap-2"><Button onClick={exportPupils} disabled={!filtered.length} className="w-full" testId="button-download-pupil-list"><Download className="size-4" /> CSV</Button><FormatDownloadButtons filename={`pupils-${classFilter}.xls`} columns={pupilColumns} rows={pupilRows} disabled={!filtered.length} testId="button-download-pupil-list" /></div></div></div></Panel>;
}

function AttendanceRegisterHistory() {
  const [location] = useLocation();
  const { data: session } = useGetCurrentUser();
  const attendance = useGetAttendance({}, { query: { enabled: location.split('?')[0] === '/attendance', queryKey: getGetAttendanceQueryKey({}) } });
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [classFilter, setClassFilter] = useState('All classes');
  if (location.split('?')[0] !== '/attendance' || !session?.user) return null;
  const records = attendance.data || [];
  const classOptions = Array.from(new Set(records.map((record) => record.className))).sort();
  const filteredRecords = records.filter((record) => (!fromDate || record.date >= fromDate) && (!toDate || record.date <= toDate) && (classFilter === 'All classes' || record.className === classFilter));
  const groups = Array.from(filteredRecords.reduce((map, record) => {
    const key = `${record.date}|${record.className}`;
    const current = map.get(key) || [];
    current.push(record);
    map.set(key, current);
    return map;
  }, new Map<string, AttendanceRecord[]>()).entries()).sort(([a], [b]) => b.localeCompare(a));
  const attendanceColumns = ['Date', 'Class', 'Registration number', 'Pupil name', 'Status', 'Arrival time'];
  const attendanceRows = (group: AttendanceRecord[]) => group.map((record) => [record.date, record.className, record.registrationNumber, record.studentName, record.status, record.arrivalTime || 'N/A']);
  const exportGroup = (group: AttendanceRecord[], filename: string) => downloadCsv(filename, attendanceColumns, attendanceRows(group));
  const exportRange = () => exportGroup(filteredRecords, `attendance-${fromDate || 'all'}-to-${toDate || 'all'}.csv`);
  return <Panel className="mb-6 border-[hsl(var(--primary)/.25)] bg-[hsl(var(--secondary)/.14)] p-4" testId="panel-saved-attendance-registers"><div className="flex flex-col gap-4"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div><p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Saved attendance lists</p><h2 className="mt-1 font-display text-xl">Attendance registers</h2><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Registers are grouped by the date and class they were created for. Open one to edit it or download it.</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={exportRange} disabled={!filteredRecords.length} testId="button-download-attendance-range"><Download className="size-4" /> CSV</Button><FormatDownloadButtons filename="attendance-selection.xls" columns={attendanceColumns} rows={attendanceRows(filteredRecords)} disabled={!filteredRecords.length} testId="button-download-attendance-range" /></div></div><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold">From date<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm" data-testid="input-attendance-download-from" /></label><label className="text-xs font-semibold">To date<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm" data-testid="input-attendance-download-to" /></label><label className="text-xs font-semibold">Class<select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm" data-testid="select-attendance-download-class"><option>All classes</option>{classOptions.map((option) => <option key={option}>{option}</option>)}</select></label></div>{attendance.isError ? <p className="text-sm text-[hsl(var(--destructive))]">Saved attendance lists could not be loaded.</p> : !groups.length ? <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-4 text-sm text-[hsl(var(--muted-foreground))]">No saved attendance lists match these filters.</p> : <div className="grid gap-2 md:grid-cols-2">{groups.slice(0, 12).map(([key, group]) => { const [date, className] = key.split('|'); return <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3"><div><p className="text-sm font-semibold">Attendance list of {date}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{className} · {group.length} pupils</p></div><div className="flex shrink-0 gap-2"><Link href={`/attendance?date=${encodeURIComponent(date)}&className=${encodeURIComponent(className)}`} className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline" data-testid={`link-attendance-register-${date}-${className}`}>Edit</Link><button type="button" onClick={() => exportGroup(group, `attendance-${date}-${className.replaceAll(' ', '-')}.csv`)} className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline" data-testid={`button-download-attendance-${date}-${className}`}>CSV</button><FormatDownloadButtons filename={`attendance-${date}-${className}.xls`} columns={attendanceColumns} rows={attendanceRows(group)} testId={`button-download-attendance-${date}-${className}`} /></div></div>; })}</div>}</div></Panel>;
}

function ExpenseReportToolbar() {
  const [location] = useLocation();
  const operations = useGetOperations({ query: { enabled: location === '/expenses', queryKey: getGetOperationsQueryKey() } });
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  if (location !== '/expenses') return null;
  const rows = (operations.data?.modules?.expenses || []) as OperationExpense[];
  const filtered = rows.filter((row) => (!fromDate || row.date >= fromDate) && (!toDate || row.date <= toDate));
  const total = filtered.reduce((sum, row) => sum + row.amount, 0);
  const expenseColumns = ['Date', 'Category', 'Description', 'Amount (UGX)', 'Reference', 'Status'];
  const expenseRows = filtered.map((row) => [row.date, row.category, row.description, row.amount, (row as OperationExpense & { reference?: string }).reference || 'N/A', row.status]);
  const exportExpenses = () => downloadCsv(`expenses-${fromDate || 'all'}-to-${toDate || 'all'}.csv`, expenseColumns, expenseRows);
  return <Panel className="mb-6 border-[hsl(var(--primary)/.25)] bg-[hsl(var(--secondary)/.14)] p-4" testId="panel-expense-downloads"><div className="flex flex-col gap-4"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div><p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Expense reports</p><h2 className="mt-1 font-display text-xl">Download expenses by date</h2><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{filtered.length} records · Total {new Intl.NumberFormat('en-UG', { style: 'currency', currency: operations.data?.currencyCode || 'UGX', maximumFractionDigits: 0 }).format(total)}</p></div><div className="flex flex-wrap gap-2"><Link href="/expenses/create"><Button testId="button-open-create-expense"><ReceiptText className="size-4" /> Create new expense</Button></Link><Button variant="secondary" onClick={exportExpenses} disabled={!filtered.length} testId="button-download-expense-report"><Download className="size-4" /> CSV</Button><FormatDownloadButtons filename={`expenses-${fromDate || 'all'}-to-${toDate || 'all'}.xls`} columns={expenseColumns} rows={expenseRows} disabled={!filtered.length} testId="button-download-expense-report" /></div></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">From date<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm" data-testid="input-expense-report-from" /></label><label className="text-xs font-semibold">To date<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm" data-testid="input-expense-report-to" /></label></div></div></Panel>;
}

export function SchoolMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 opacity-95 print:hidden" data-testid="brand-school">
      <img src="/school-logo.jpg" alt={`${SCHOOL_NAME} crest`} className={`shrink-0 rounded-full border-2 border-white/90 bg-white p-1 object-contain shadow-sm ${compact ? 'h-8 w-8' : 'h-10 w-10 sm:h-11 sm:w-11'}`} />
      <span className="hidden basis-full text-[10px] leading-4 text-[hsl(var(--muted-foreground))] print:block">{SCHOOL_POSTAL_ADDRESS} · {SCHOOL_PHONE} · {SCHOOL_LOCATION}</span>
    </div>
  );
}

export function SchoolLetterhead() {
  return (
    <header className="hidden print:flex print:items-center print:gap-5 print:border-b-2 print:border-[hsl(var(--primary))] print:pb-4" data-testid="print-school-letterhead">
      <img src="/school-logo.jpg" alt={`${SCHOOL_NAME} crest`} className="h-24 w-24 shrink-0 rounded-full object-contain" />
      <div className="min-w-0 flex-1">
        <div>
          <h1 className="font-display text-2xl font-bold text-[hsl(var(--foreground))]">{SCHOOL_NAME}</h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[.12em] text-[hsl(var(--primary))]">Official school document</p>
        </div>
        <p className="mt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{SCHOOL_POSTAL_ADDRESS} · Tel: {SCHOOL_PHONE} · {SCHOOL_LOCATION}</p>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const client = useQueryClient();
  const { data: session } = useGetCurrentUser();
  const logout = useLogout();
  const user = session?.user;
  const displayName = user?.name || 'School administrator';
  const roleLabel = (user?.role || 'administrator').replace('_', ' ');
  const navRole = user?.role === 'super_admin' ? 'administrator' : user?.role || 'staff';
  const canFinance = user?.role === 'administrator' || user?.role === 'super_admin' || user?.role === 'accountant' || user?.permissions.includes('finance_view');
  const canExpenses = user?.role === 'administrator' || user?.role === 'super_admin' || user?.role === 'accountant' || user?.permissions.includes('expenses_view');
  const navItems = (roleNavigation[navRole] || roleNavigation.staff).filter((item) => {
    if (item.href === '/finance' || item.href === '/transactions') return canFinance;
    if (item.href === '/expenses') return canExpenses;
    return true;
  }).map((item) => {
    if ((user?.role === 'guardian' || user?.role === 'student') && user.studentId && item.href.includes('/students/stu-001')) {
      return { ...item, href: item.href.replace('/students/stu-001', `/students/${user.studentId}`) };
    }
    return item;
  });

  const handleLogout = () => {
    setProfileOpen(false);
    logout.mutate(undefined, { onSettled: () => { client.removeQueries({ queryKey: getGetCurrentUserQueryKey() }); setLocation('/'); } });
  };
  useEffect(() => {
    if (!profileOpen) return;
    const closeMenu = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, [profileOpen]);
  return (
    <div className="flex min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {mobileOpen && <button aria-label="Close navigation" data-testid="button-close-mobile-nav" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-[hsl(var(--foreground)/.32)] md:hidden" />}
      <aside className={`sidebar-shadow fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-[82px]' : ''}`}>
        <div className="flex h-[82px] items-center justify-between border-b border-[hsl(var(--sidebar-border))] px-5">
          <div className="min-w-0">
            <SchoolMark compact={collapsed} />
            {!collapsed && <p className="mt-2 truncate pl-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[hsl(var(--sidebar-foreground)/.6)]">{SCHOOL_NAME}</p>}
          </div>
          <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-[hsl(var(--sidebar-foreground)/.7)] hover:bg-[hsl(var(--sidebar-accent))] md:hidden" data-testid="button-close-sidebar"><X className="size-4" /></button>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="Primary navigation">
          <p className={`mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.42)] ${collapsed ? 'md:hidden' : ''}`}>Workspace</p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href || (href === '/students' && location.startsWith('/students/'));
            return <Link href={href} key={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`group flex min-h-11 touch-manipulation items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? 'bg-[hsl(var(--sidebar-primary))] font-semibold text-[hsl(var(--sidebar-primary-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.68)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]'} ${collapsed ? 'md:justify-center md:px-2' : ''}`}>
              <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.4 : 1.8} /><span className={collapsed ? 'md:hidden' : ''}>{label}</span>{active && !collapsed && <span className="ml-auto size-1.5 rounded-full bg-[hsl(var(--sidebar-primary-foreground)/.55)]" />}
            </Link>;
          })}
          <p className={`mb-3 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.42)] ${collapsed ? 'md:hidden' : ''}`}>School</p>
           <Link href="/manual" onClick={() => setMobileOpen(false)} data-testid="link-nav-user-manual" className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[hsl(var(--sidebar-foreground)/.82)] transition-colors hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))] ${location === '/manual' ? 'bg-[hsl(var(--sidebar-primary))] font-semibold text-[hsl(var(--sidebar-primary-foreground))]' : ''} ${collapsed ? 'md:justify-center md:px-2' : ''}`}><BookOpen className="size-[18px] shrink-0" /><span className={collapsed ? 'md:hidden' : ''}>User manual</span></Link>
        </nav>
        <div className={`border-t border-[hsl(var(--sidebar-border))] p-3 ${collapsed ? 'md:px-2' : ''}`}>
           <div className={`flex items-center gap-2 px-3 py-2 text-[11px] text-[hsl(var(--sidebar-foreground)/.48)] ${collapsed ? 'md:justify-center md:px-2' : ''}`}><ShieldCheck className="size-3.5 text-[hsl(var(--accent))]" /><span className={collapsed ? 'md:hidden' : ''}>Secure school workspace</span></div>
        </div>
      </aside>
      <div className={`flex min-w-0 flex-1 flex-col transition-[margin] duration-300 md:ml-[264px] ${collapsed ? 'md:ml-[82px]' : ''}`}>
        <header className="sticky top-0 z-20 flex h-[82px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.92)] px-5 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] md:hidden" data-testid="button-open-mobile-nav"><Menu className="size-5" /></button>
            <button onClick={() => setCollapsed(!collapsed)} className="hidden rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] md:block" data-testid="button-toggle-sidebar">{collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}</button>
            <div className="hidden items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))] lg:flex"><Search className="size-3.5" /><span>Search Emmecty</span><kbd className="ml-5 rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 font-mono text-[10px]">⌘ K</kbd></div>
          </div>
             <div className="relative" ref={profileMenuRef}>
               <button onClick={() => setProfileOpen((open) => !open)} data-testid="button-profile-menu" aria-label="Open profile menu" aria-expanded={profileOpen} className="group flex items-center gap-2.5 rounded-xl p-1.5 pr-2 transition-colors hover:bg-[hsl(var(--muted))]"><Initials name={displayName} className="size-8" /><span className="hidden text-left sm:block"><span className="block max-w-[140px] truncate text-xs font-semibold">{displayName}</span><span className="block text-[10px] capitalize text-[hsl(var(--muted-foreground))]">{roleLabel}</span></span></button>
               {profileOpen && <div className="absolute right-0 top-[calc(100%+.5rem)] z-50 w-56 overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1.5 shadow-xl" role="menu">
                 <div className="border-b border-[hsl(var(--border))] px-3 py-2.5"><p className="truncate text-sm font-semibold">{displayName}</p><p className="mt-0.5 truncate text-xs capitalize text-[hsl(var(--muted-foreground))]">{roleLabel}</p></div>
                 <Link href="/profile" onClick={() => setProfileOpen(false)} data-testid="link-header-profile" role="menuitem" className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-[hsl(var(--muted))]"><UserRound className="size-4 text-[hsl(var(--primary))]" /> Profile</Link>
                 {(user?.role === 'administrator' || user?.role === 'super_admin') && <Link href="/settings" onClick={() => setProfileOpen(false)} data-testid="link-header-settings" role="menuitem" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-[hsl(var(--muted))]"><Settings className="size-4 text-[hsl(var(--primary))]" /> Settings</Link>}
                 <button onClick={handleLogout} disabled={logout.isPending} data-testid="button-logout" role="menuitem" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)] disabled:cursor-not-allowed disabled:opacity-50"><LogOut className="size-4" /> {logout.isPending ? 'Signing out…' : 'Sign out'}</button>
               </div>}
             </div>
        </header>
          <main className="flex-1 overflow-x-hidden"><div className="hidden print:block print:px-8 print:pt-6"><SchoolLetterhead /></div><div className="mx-auto w-full max-w-[1480px] p-5 md:p-8">{user && (user.role === 'administrator' || user.role === 'super_admin') && location.startsWith('/students/') && !location.endsWith('/report') && <div className="mb-5 flex flex-wrap justify-end gap-2 print:hidden"><Link href={`${location}/report`} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110" data-testid="link-create-report-card"><FileBarChart className="size-4" /> Create report card</Link></div>}<PupilExportToolbar /><AttendanceRegisterHistory /><ExpenseReportToolbar />{children}</div></main>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  const displayTitle = title === 'Students' ? 'Pupil directory' : title;
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end animate-rise-in"><div><p className="mb-2 font-mono-ui text-[10px] font-semibold uppercase tracking-[.2em] text-[hsl(var(--primary))]">{eyebrow || SCHOOL_NAME}</p><h1 className="font-display text-4xl leading-none tracking-[-.035em] text-[hsl(var(--foreground))] md:text-5xl" data-testid="text-page-title">{displayTitle}</h1>{description && <p className="mt-3 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]" data-testid="text-page-description">{description}</p>}</div>{action && <div className="shrink-0">{action}</div>}</div>;
}

export function Button({ children, onClick, variant = 'primary', type = 'button', disabled = false, className = '', testId = 'button-action' }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; type?: 'button' | 'submit'; disabled?: boolean; className?: string; testId?: string }) {
  const styles = { primary: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:brightness-110', secondary: 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]', quiet: 'text-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary))]', danger: 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:brightness-110' };
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}>{children}</button>;
}

export function Panel({ children, className = '', testId }: { children: ReactNode; className?: string; testId?: string }) {
  return <section className={`soft-shadow rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] ${className}`} data-testid={testId}>{children}</section>;
}

export function Skeleton({ className = '' }: { className?: string }) { return <div className={`animate-soft-pulse rounded-lg bg-[hsl(var(--muted))] ${className}`} aria-label="Loading" data-testid="loading-skeleton" />; }

export function EmptyState({ icon: Icon = UserRound, title, description, action }: { icon?: typeof UserRound; title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center px-6 py-14 text-center" data-testid="empty-state"><span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Icon className="size-5" /></span><h3 className="font-display text-xl">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

export function ErrorState({ onRetry, message = 'We could not load this part of your workspace.' }: { onRetry?: () => void; message?: string }) {
  return <div className="flex flex-col items-center justify-center px-6 py-14 text-center" data-testid="error-state"><span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-[hsl(var(--destructive)/.12)] text-[hsl(var(--destructive))]"><ShieldCheck className="size-5" /></span><h3 className="font-display text-xl">A small interruption</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">{message}</p>{onRetry && <Button onClick={onRetry} variant="secondary" className="mt-5" testId="button-retry">Try again</Button>}</div>;
}