import { Link } from 'wouter';
import { getGetStudentAcademicHistoryQueryKey, useGetStudentAcademicHistory } from '@workspace/api-client-react';
import { Panel, Skeleton } from '@/components/school-shell';

type RecordItem = Record<string, unknown>;
const rows = (value: unknown): RecordItem[] =>
  Array.isArray(value) ? value.filter((item): item is RecordItem => !!item && typeof item === 'object' && !Array.isArray(item)) : [];
const text = (value: unknown) => value == null ? '' : String(value);

export function AcademicStudentPanel({ studentId }: { studentId: string }) {
  const history = useGetStudentAcademicHistory(studentId, { query: { enabled: !!studentId, queryKey: getGetStudentAcademicHistoryQueryKey(studentId) } });
  const data = history.data as RecordItem | undefined;
  const enrollments = rows(data?.enrollments);
  const charges = rows(data?.charges);
  const departures = rows(data?.departures);
  const money = (value: unknown) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(Number(value || 0));

  return <Panel className="p-6" testId="panel-pupil-academic-ledger">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--primary))]">Permanent pupil record</p><h2 className="mt-1 font-display text-2xl">Term and enrollment history</h2></div>
      <Link href="/academic-years" className="rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))]">Open academic workspace</Link>
    </div>
    {history.isLoading ? <Skeleton className="mt-5 h-28 w-full" /> : history.isError ? <p className="mt-5 text-sm text-[hsl(var(--destructive))]" role="alert">Academic history could not be loaded. <button type="button" className="underline" onClick={() => void history.refetch()}>Retry</button></p> : !enrollments.length ? <p className="mt-5 text-sm text-[hsl(var(--muted-foreground))]">No academic enrollment has been assigned yet. The pupil’s existing profile and older payments remain unchanged.</p> : <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {enrollments.map((entry) => <div key={text(entry.id)} className="rounded-xl border border-[hsl(var(--border))] p-4"><p className="text-xs font-semibold text-[hsl(var(--primary))]">{text(entry.year)} · {text(entry.status)}</p><p className="mt-1 font-semibold">{text(entry.className)}{entry.stream ? ` · ${text(entry.stream)}` : ''}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">From {text(entry.enrolledOn)}{entry.endedOn ? ` to ${text(entry.endedOn)}` : ''}{entry.repeating ? ' · Repeating' : ''}</p></div>)}
      </div>
      {charges.length > 0 && <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))]"><th className="py-2">Term fee</th><th className="py-2">Charged</th><th className="py-2">Paid</th><th className="py-2">Receipts</th></tr></thead><tbody>{charges.map((charge) => <tr key={text(charge.id)} className="border-b border-[hsl(var(--border))]"><td className="py-3">{text(charge.category)} · Term {text(charge.termNumber)}</td><td className="py-3">{money(charge.amount)}</td><td className="py-3">{money(charge.paid)}</td><td className="py-3">{rows(charge.payments).map((payment) => text(payment.receiptNumber)).join(', ') || '—'}</td></tr>)}</tbody></table></div>}
      {departures.length > 0 && <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Departure history: {departures.map((entry) => `${text(entry.kind)} ${text(entry.leavingOn)}`).join('; ')}. Old charges and receipts remain available.</p>}
    </>}
  </Panel>;
}