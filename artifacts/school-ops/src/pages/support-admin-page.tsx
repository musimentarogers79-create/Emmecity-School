import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { AlertTriangle, ArrowLeft, ArrowRight, ArrowRightLeft, CheckCircle2, CircleDollarSign, LockKeyhole, LogOut, Search, ShieldAlert, Trash2 } from 'lucide-react';

type SupportSession = { expiresAt: string };
type SmsAllowance = {
  schoolName: string;
  availableMessages: number;
  reservedMessages: number;
  sentMessages: number;
  adjustments: Array<{ messages: number; note: string; actor: string; occurredAt: string }>;
};
type SmsReconciliation = {
  id: string;
  channel: string;
  recipientCount: number;
  status: 'sending' | 'reconciliation_required';
  occurredAt: string;
  failureCode?: string;
};
type SmsReconciliationAudit = {
  deliveryId: string;
  outcome: 'sent' | 'failed';
  messages: number;
  note: string;
  actor: string;
  occurredAt: string;
};
type SupportPupil = {
  id: string;
  schoolName: string;
  registrationNumber: string;
  name: string;
  className: string;
  stream: string;
  status: 'active' | 'inactive';
  isSponsored: boolean;
};
type DeletePupilResult = {
  message: string;
  deletedAttendanceRecords: number;
  deletedPaymentRecords: number;
  deletedLinkedAccounts: number;
  deletedLinkedRecords: number;
  photoStatus: 'removed' | 'not_present' | 'shared' | 'failed';
};

class SupportApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const sessionKey = ['support-session'] as const;
const pupilKey = (search: string) => ['support-pupils', search] as const;
const allowanceKey = ['support-sms-allowance'] as const;
const reconciliationKey = ['support-sms-reconciliation'] as const;

async function supportRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) {
    throw new SupportApiError(body?.error || 'The support request could not be completed.', response.status);
  }
  return body as T;
}

function SupportLogin({ onSuccess }: { onSuccess: (session: SupportSession) => void }) {
  const [password, setPassword] = useState('');
  const login = useMutation({
    mutationFn: (value: string) => supportRequest<SupportSession>('/api/support/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: value }),
    }),
    onSuccess,
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate(password);
  };

  return <main className="grid min-h-screen bg-[#f6f3eb] text-[hsl(var(--foreground))] lg:grid-cols-2">
    <section className="flex items-center justify-center bg-white px-5 py-12 sm:px-10">
      <div className="w-full max-w-md">
        <p className="mt-0 font-mono-ui text-[10px] font-semibold uppercase tracking-[.2em] text-[hsl(var(--primary))]">Restricted access</p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-[-.04em] sm:text-5xl">Support workspace</h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-[hsl(var(--muted-foreground))]">Manage prepaid SMS allowance and, when authorised, enter the school workspace with a distinct Corenexa Support identity.</p>
        <div className="mt-8 flex gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <p>Support access uses its own secure session and identity; it does not sign in as or modify the school administrator account.</p>
        </div>
      </div>
    </section>
    <section className="flex items-center justify-center px-5 py-12 sm:px-10">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"><ArrowLeft className="size-4" /> Back to school sign in</Link>
        <div className="mt-6 rounded-3xl border border-[hsl(var(--border))] bg-white p-6 shadow-[0_20px_60px_rgba(27,67,57,.10)] sm:p-8">
          <div className="mb-6 flex size-11 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><LockKeyhole className="size-5" /></div>
          <h2 className="font-display text-2xl">Sign in to support</h2>
          <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Use the support account password provided through the secure workspace setup.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <input type="text" name="username" value="support" autoComplete="username" readOnly className="sr-only" tabIndex={-1} aria-hidden="true" />
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">Support password</span>
              <input
                autoComplete="current-password"
                autoFocus
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-white px-3.5 text-sm outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.15)]"
                data-testid="input-support-password"
              />
            </label>
            {login.isError && <p role="alert" className="rounded-xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.07)] p-3 text-sm text-[hsl(var(--destructive))]" data-testid="status-support-login-error">{login.error.message}</p>}
            <button type="submit" disabled={login.isPending} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 disabled:cursor-wait disabled:opacity-60" data-testid="button-support-sign-in">
              {login.isPending ? 'Verifying…' : 'Sign in securely'}
            </button>
          </form>
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><LockKeyhole className="size-3.5" /> Separate, time-limited support session</p>
      </div>
    </section>
  </main>;
}

function DeletionDialog({ pupil, onClose, onDelete, isPending, error }: {
  pupil: SupportPupil;
  onClose: () => void;
  onDelete: (registrationNumber: string) => void;
  isPending: boolean;
  error?: string;
}) {
  const [confirmation, setConfirmation] = useState('');
  const canConfirm = confirmation === pupil.registrationNumber;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation">
    <section role="alertdialog" aria-modal="true" aria-labelledby="delete-pupil-title" className="w-full max-w-xl rounded-t-3xl border border-[hsl(var(--border))] bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700"><AlertTriangle className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.16em] text-red-700">Permanent action</p>
          <h2 id="delete-pupil-title" className="mt-1 font-display text-2xl">Delete this pupil everywhere?</h2>
          <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">This cannot be undone. The pupil profile, admission documents, attendance, payment history, linked pupil accounts, and other pupil-linked school records will be permanently removed.</p>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)] p-4">
        <p className="text-sm font-semibold">{pupil.name}</p>
        <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{pupil.schoolName} · {pupil.registrationNumber} · {pupil.className} {pupil.stream}</p>
      </div>
      <label className="mt-5 block">
        <span className="mb-1.5 block text-xs font-semibold">Type the registration number to confirm</span>
        <input
          autoComplete="off"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-white px-3.5 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/15"
          data-testid="input-confirm-pupil-registration"
        />
      </label>
      {error && <p role="alert" className="mt-3 rounded-xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.07)] p-3 text-sm text-[hsl(var(--destructive))]" data-testid="status-support-delete-error">{error}</p>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={isPending} className="min-h-11 rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-semibold hover:bg-[hsl(var(--muted)/.5)] disabled:opacity-60" data-testid="button-cancel-pupil-delete">Cancel</button>
        <button type="button" onClick={() => onDelete(confirmation)} disabled={!canConfirm || isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-45" data-testid="button-confirm-pupil-delete">
          <Trash2 className="size-4" /> {isPending ? 'Deleting permanently…' : 'Delete pupil permanently'}
        </button>
      </div>
    </section>
  </div>;
}

export default function SupportAdminPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedPupil, setSelectedPupil] = useState<SupportPupil | null>(null);
  const [notice, setNotice] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [reconciliationNotes, setReconciliationNotes] = useState<Record<string, string>>({});
  const [sessionClosed, setSessionClosed] = useState(false);
  const handleSupportLoginSuccess = (nextSession: SupportSession) => {
    setSessionClosed(false);
    queryClient.setQueryData(sessionKey, nextSession);
  };
  const normalizedSearch = search.trim();
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: () => supportRequest<SupportSession>('/api/support/auth/me'),
    retry: false,
    staleTime: 30_000,
  });
  const pupils = useQuery({
    queryKey: pupilKey(normalizedSearch),
    queryFn: () => supportRequest<{ pupils: SupportPupil[] }>(`/api/support/pupils?search=${encodeURIComponent(normalizedSearch)}`),
    enabled: Boolean(session.data) && normalizedSearch.length >= 2,
    staleTime: 10_000,
  });
  const allowance = useQuery({
    queryKey: allowanceKey,
    queryFn: () => supportRequest<SmsAllowance>('/api/support/sms-allowance'),
    enabled: Boolean(session.data),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  const reconciliations = useQuery({
    queryKey: reconciliationKey,
    queryFn: () => supportRequest<{ deliveries: SmsReconciliation[]; resolutions: SmsReconciliationAudit[] }>('/api/support/sms-reconciliation'),
    enabled: Boolean(session.data),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
  const reconcileDelivery = useMutation({
    mutationFn: ({ delivery, outcome, note }: { delivery: SmsReconciliation; outcome: 'sent' | 'failed'; note: string }) =>
      supportRequest<{ message: string }>(`/api/support/sms-reconciliation/${encodeURIComponent(delivery.id)}`, {
        method: 'POST',
        body: JSON.stringify({ outcome, note }),
      }),
    onSuccess: async (_value, variables) => {
      setReconciliationNotes((current) => ({ ...current, [variables.delivery.id]: '' }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reconciliationKey }),
        queryClient.invalidateQueries({ queryKey: allowanceKey }),
      ]);
    },
  });
  const adjustAllowance = useMutation({
    mutationFn: ({ messages, note }: { messages: number; note: string }) =>
      supportRequest<SmsAllowance>('/api/support/sms-allowance', {
        method: 'POST',
        body: JSON.stringify({ messages, note }),
      }),
    onSuccess: async (value) => {
      queryClient.setQueryData(allowanceKey, value);
      setAdjustment('');
      setAdjustmentNote('');
      await queryClient.invalidateQueries({ queryKey: allowanceKey });
    },
  });
  const logout = useMutation({
    mutationFn: () => supportRequest<{ message: string }>('/api/support/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      setSessionClosed(true);
      setSearch('');
      setSelectedPupil(null);
      setNotice('');
      setAdjustment('');
      setAdjustmentNote('');
      queryClient.removeQueries({ queryKey: ['support-pupils'] });
      queryClient.removeQueries({ queryKey: allowanceKey });
      queryClient.removeQueries({ queryKey: sessionKey, exact: true });
    },
  });
  const removePupil = useMutation({
    mutationFn: ({ pupil, registrationNumber }: { pupil: SupportPupil; registrationNumber: string }) =>
      supportRequest<DeletePupilResult>(`/api/support/pupils/${encodeURIComponent(pupil.id)}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmRegistrationNumber: registrationNumber }),
      }),
    onSuccess: async (result, variables) => {
      const photoNote = result.photoStatus === 'failed'
        ? ' The photo could not be removed and needs manual storage cleanup.'
        : result.photoStatus === 'shared'
          ? ' The photo is still used by another pupil and was kept.'
          : '';
      setNotice(`${variables.pupil.name} was deleted. Removed ${result.deletedAttendanceRecords} attendance records, ${result.deletedPaymentRecords} payment records, ${result.deletedLinkedAccounts} linked accounts, and ${result.deletedLinkedRecords} linked school records.${photoNote}`);
      setSelectedPupil(null);
      await queryClient.invalidateQueries({ queryKey: ['support-pupils'] });
    },
  });

  if (sessionClosed) {
    return <SupportLogin onSuccess={handleSupportLoginSuccess} />;
  }
  if (session.isLoading) {
    return <main className="grid min-h-screen place-items-center bg-[#f6f3eb] p-6 text-sm text-[hsl(var(--muted-foreground))]" data-testid="support-session-loading">Checking secure support session…</main>;
  }
  if (!session.data && session.isError && (session.error as SupportApiError).status !== 401) {
    return <main className="grid min-h-screen place-items-center bg-[#f6f3eb] p-6">
      <section className="max-w-md rounded-3xl border border-[hsl(var(--border))] bg-white p-6 shadow-lg">
        <h1 className="font-display text-2xl">Support workspace unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{session.error.message}</p>
        <button type="button" onClick={() => void session.refetch()} className="mt-5 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-white">Try again</button>
      </section>
    </main>;
  }
  if (!session.data) {
    return <SupportLogin onSuccess={handleSupportLoginSuccess} />;
  }

  return <main className="min-h-screen bg-[#f6f3eb] text-[hsl(var(--foreground))]">
    <header className="border-b border-[hsl(var(--border))] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">Support operations workspace</p><p className="text-[10px] text-[hsl(var(--muted-foreground))]">Separate Corenexa Support identity</p></div>
        </div>
        <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-xs font-semibold hover:bg-[hsl(var(--muted)/.45)] disabled:opacity-50" data-testid="button-support-logout"><LogOut className="size-4" /> Sign out</button>
      </div>
    </header>
    {logout.isError && <p role="alert" className="mx-auto mt-4 max-w-6xl px-5 text-sm text-[hsl(var(--destructive))] sm:px-8" data-testid="status-support-logout-error">Sign out could not be completed. Your support session may still be active; please try again.</p>}
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.2em] text-[hsl(var(--primary))]">Authorised support use only</p><h1 className="mt-2 font-display text-3xl tracking-[-.03em] sm:text-4xl">Support operations</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Review prepaid SMS balance, record audited allowance adjustments, or enter the regular EMMECTY workspace under Corenexa Support.</p></div>
        <Link href="/dashboard" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3 py-2 text-xs font-semibold text-white hover:brightness-110" data-testid="link-support-open-school-workspace"><ArrowRight className="size-4" /> Open school system as Support</Link>
      </div>

      <section className="rounded-3xl border border-[hsl(var(--border))] bg-white p-5 shadow-[0_12px_35px_rgba(27,67,57,.06)] sm:p-7" data-testid="panel-support-sms-allowance">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><CircleDollarSign className="size-5" /></span><div><p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Prepaid SMS messages</p><h2 className="mt-1 font-display text-2xl">{allowance.data?.schoolName || 'School allowance'}</h2><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">One message is counted for each unique recipient; current sender behavior compacts every message to one SMS segment.</p></div></div>
          <button type="button" onClick={() => void allowance.refetch()} className="min-h-9 rounded-lg border border-[hsl(var(--border))] px-3 text-xs font-semibold hover:bg-[hsl(var(--muted)/.4)]">Refresh balance</button>
        </div>
        {allowance.isLoading ? <p className="mt-5 text-sm text-[hsl(var(--muted-foreground))]">Loading SMS allowance…</p>
          : allowance.isError ? <div className="mt-5 rounded-xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.06)] p-3 text-sm text-[hsl(var(--destructive))]" role="alert">{allowance.error.message}</div>
            : allowance.data && <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[hsl(var(--muted)/.4)] p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Available</p><p className="mt-1 text-2xl font-semibold" data-testid="text-sms-allowance-available">{allowance.data.availableMessages.toLocaleString()}</p></div>
              <div className="rounded-2xl bg-[hsl(var(--muted)/.4)] p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">In progress</p><p className="mt-1 text-2xl font-semibold">{allowance.data.reservedMessages.toLocaleString()}</p></div>
              <div className="rounded-2xl bg-[hsl(var(--muted)/.4)] p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Provider accepted</p><p className="mt-1 text-2xl font-semibold">{allowance.data.sentMessages.toLocaleString()}</p></div>
            </div>}
        <form className="mt-6 grid gap-3 border-t border-[hsl(var(--border))] pt-5 sm:grid-cols-[minmax(150px,.6fr)_minmax(220px,1.4fr)_auto]" onSubmit={(event) => {
          event.preventDefault();
          const messages = Number(adjustment);
          if (Number.isSafeInteger(messages) && messages !== 0 && adjustmentNote.trim()) adjustAllowance.mutate({ messages, note: adjustmentNote.trim() });
        }}>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold">Whole-message adjustment</span><input type="number" step="1" required value={adjustment} onChange={(event) => setAdjustment(event.target.value)} placeholder="e.g. 500 or -20" className="h-11 w-full rounded-xl border border-[hsl(var(--input))] px-3 text-sm" data-testid="input-support-sms-adjustment" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold">Audit note</span><input required maxLength={500} value={adjustmentNote} onChange={(event) => setAdjustmentNote(event.target.value)} placeholder="Grant reference or reason for adjustment" className="h-11 w-full rounded-xl border border-[hsl(var(--input))] px-3 text-sm" data-testid="input-support-sms-note" /></label>
          <button type="submit" disabled={adjustAllowance.isPending || !adjustment || Number(adjustment) === 0 || !adjustmentNote.trim()} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50" data-testid="button-support-adjust-sms"><ArrowRightLeft className="size-4" />{adjustAllowance.isPending ? 'Saving…' : 'Apply adjustment'}</button>
        </form>
        {adjustAllowance.isError && <p className="mt-3 text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="status-support-sms-adjustment-error">{adjustAllowance.error.message}</p>}
        <div className="mt-6 border-t border-[hsl(var(--border))] pt-5">
          <h3 className="text-sm font-semibold">Recent allowance adjustments</h3>
          {!allowance.data?.adjustments.length ? <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">No support adjustments have been recorded.</p>
            : <ul className="mt-3 divide-y divide-[hsl(var(--border))]">{allowance.data.adjustments.map((item, index) => <li key={`${item.occurredAt}-${index}`} className="flex flex-wrap justify-between gap-2 py-2 text-xs"><span><strong className={item.messages > 0 ? 'text-emerald-700' : 'text-amber-800'}>{item.messages > 0 ? '+' : ''}{item.messages.toLocaleString()}</strong> · {item.note} <span className="text-[hsl(var(--muted-foreground))]">by {item.actor}</span></span><time className="text-[hsl(var(--muted-foreground))]">{new Date(item.occurredAt).toLocaleString()}</time></li>)}</ul>}
        </div>
      </section>

      <section className="rounded-3xl border border-amber-300/70 bg-white p-5 shadow-[0_12px_35px_rgba(27,67,57,.06)] sm:p-7" data-testid="panel-support-sms-reconciliation">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 size-5 shrink-0 text-amber-700" />
          <div>
            <h2 className="font-display text-2xl">SMS delivery reconciliation</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">An ambiguous provider result keeps its message reservation and blocks automatic retries. Check the provider's delivery status before selecting an outcome: accepted messages stay charged; confirmed failures release the reservation. Each resolution is audited.</p>
          </div>
        </div>
        {reconciliations.isLoading ? <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Checking for unresolved SMS sends…</p>
          : reconciliations.isError ? <p className="mt-4 text-sm text-[hsl(var(--destructive))]" role="alert">{reconciliations.error.message}</p>
            : !reconciliations.data?.deliveries.length ? <p className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] p-4 text-sm text-[hsl(var(--muted-foreground))]">No SMS delivery reservations require reconciliation.</p>
              : <div className="mt-4 space-y-3">
                {reconciliations.data.deliveries.map((delivery) => {
                  const note = reconciliationNotes[delivery.id] ?? '';
                  return <article key={delivery.id} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4" data-testid={`card-sms-reconciliation-${delivery.id}`}>
                    <div className="flex flex-wrap justify-between gap-2 text-xs"><span className="font-semibold">{delivery.channel.replaceAll('_', ' ')} · {delivery.recipientCount} messages · {delivery.status.replaceAll('_', ' ')}</span><time className="text-[hsl(var(--muted-foreground))]">{new Date(delivery.occurredAt).toLocaleString()}</time></div>
                    {delivery.failureCode && <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">Reason: {delivery.failureCode}</p>}
                    <label className="mt-3 block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide">Reconciliation note</span><input maxLength={500} value={note} onChange={(event) => setReconciliationNotes((current) => ({ ...current, [delivery.id]: event.target.value }))} placeholder="Record the provider check or resolution basis" className="h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-white px-3 text-xs" /></label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={reconcileDelivery.isPending || !note.trim()} onClick={() => reconcileDelivery.mutate({ delivery, outcome: 'sent', note: note.trim() })} className="min-h-9 rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-50">Provider accepted — charge allowance</button>
                      <button type="button" disabled={reconcileDelivery.isPending || !note.trim()} onClick={() => reconcileDelivery.mutate({ delivery, outcome: 'failed', note: note.trim() })} className="min-h-9 rounded-lg border border-amber-300 bg-white px-3 py-2 text-[10px] font-semibold text-amber-900 disabled:opacity-50">Confirmed not sent — release reservation</button>
                    </div>
                  </article>;
                })}
              </div>}
        {reconciliations.data?.resolutions.length ? <div className="mt-6 border-t border-[hsl(var(--border))] pt-4">
          <h3 className="text-sm font-semibold">Recent reconciliations</h3>
          <ul className="mt-2 divide-y divide-[hsl(var(--border))]">{reconciliations.data.resolutions.map((item) => <li key={`${item.deliveryId}-${item.occurredAt}`} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
            <span><strong className={item.outcome === 'sent' ? 'text-emerald-700' : 'text-amber-800'}>{item.outcome === 'sent' ? 'Accepted' : 'Confirmed not sent'} · {item.messages} message{item.messages === 1 ? '' : 's'}</strong> · {item.note} <span className="text-[hsl(var(--muted-foreground))]">by {item.actor}</span></span>
            <time className="text-[hsl(var(--muted-foreground))]">{new Date(item.occurredAt).toLocaleString()}</time>
          </li>)}</ul>
        </div> : null}
        {reconcileDelivery.isError && <p className="mt-3 text-sm text-[hsl(var(--destructive))]" role="alert">{reconcileDelivery.error.message}</p>}
      </section>

      <section className="rounded-3xl border border-[hsl(var(--border))] bg-white p-5 shadow-[0_12px_35px_rgba(27,67,57,.06)] sm:p-7">
        <label className="block max-w-2xl">
          <span className="mb-2 block text-xs font-semibold">Search pupil identities across schools</span>
          <span className="relative block">
            <Search className="absolute left-3.5 top-3.5 size-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setNotice(''); }}
              placeholder="Enter at least two characters"
              className="h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-white pl-10 pr-3.5 text-sm outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.15)]"
              data-testid="input-support-pupil-search"
            />
          </span>
        </label>
        {notice && <p role="status" aria-live="polite" className="mt-5 flex gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900" data-testid="status-support-delete-success"><CheckCircle2 className="mt-0.5 size-5 shrink-0" />{notice}</p>}
        {normalizedSearch.length < 2 ? <p className="mt-8 rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Enter at least two characters to search the shared school database.</p>
          : pupils.isLoading ? <p className="mt-8 p-5 text-center text-sm text-[hsl(var(--muted-foreground))]">Searching pupil records…</p>
            : pupils.isError ? <div className="mt-6 rounded-2xl border border-[hsl(var(--destructive)/.2)] bg-[hsl(var(--destructive)/.06)] p-4 text-sm text-[hsl(var(--destructive))]"><p>{pupils.error.message}</p><button type="button" onClick={() => void pupils.refetch()} className="mt-2 font-semibold underline">Retry search</button></div>
              : pupils.data?.pupils.length ? <div className="mt-6">
                <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">Showing up to 50 matches. Add more search text if needed.</p>
                <div className="divide-y divide-[hsl(var(--border))] rounded-2xl border border-[hsl(var(--border))]">
                  {pupils.data.pupils.map((pupil) => <article key={pupil.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">{pupil.name}</h2><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pupil.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{pupil.status}</span>{pupil.isSponsored && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">Sponsored</span>}</div>
                      <p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{pupil.schoolName}</p>
                      <p className="mt-1 font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{pupil.registrationNumber} · {pupil.className} {pupil.stream}</p>
                    </div>
                    <button type="button" onClick={() => { setSelectedPupil(pupil); setNotice(''); removePupil.reset(); }} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 sm:self-auto" data-testid={`button-delete-pupil-${pupil.id}`}><Trash2 className="size-4" /> Delete pupil</button>
                  </article>)}
                </div>
              </div> : <p className="mt-8 rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">No pupil records matched this search.</p>}
      </section>
      <p className="flex items-start gap-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><ShieldAlert className="mt-0.5 size-4 shrink-0" /> Deletion is permanent and removes attendance, financial history, linked accounts, and pupil-linked school records.</p>
    </div>
    {selectedPupil && <DeletionDialog
      pupil={selectedPupil}
      onClose={() => { if (!removePupil.isPending) { setSelectedPupil(null); removePupil.reset(); } }}
      onDelete={(registrationNumber) => removePupil.mutate({ pupil: selectedPupil, registrationNumber })}
      isPending={removePupil.isPending}
      error={removePupil.error?.message}
    />}
  </main>;
}