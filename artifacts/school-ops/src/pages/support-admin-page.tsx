import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { AlertTriangle, ArrowLeft, CheckCircle2, LockKeyhole, LogOut, Search, ShieldAlert, Trash2 } from 'lucide-react';

type SupportSession = { expiresAt: string };
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

function SupportLogin({ onSuccess }: { onSuccess: () => void }) {
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
        <img src={`${import.meta.env.BASE_URL}corenexa-systems-logo-transparent.png`} alt="Corenexa Systems" className="h-20 w-full object-contain object-left sm:h-28" />
        <p className="mt-10 font-mono-ui text-[10px] font-semibold uppercase tracking-[.2em] text-[hsl(var(--primary))]">Restricted access</p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-[-.04em] sm:text-5xl">Support workspace</h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-[hsl(var(--muted-foreground))]">Search pupil identity records across schools and permanently remove a pupil record when authorised.</p>
        <div className="mt-8 flex gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <p>This account is limited to pupil lookup and permanent deletion. It cannot open school administration or finance screens.</p>
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
  const logout = useMutation({
    mutationFn: () => supportRequest<{ message: string }>('/api/support/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
      setSearch('');
      setSelectedPupil(null);
      setNotice('');
      queryClient.removeQueries({ queryKey: ['support-pupils'] });
      await queryClient.invalidateQueries({ queryKey: sessionKey });
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
    return <SupportLogin onSuccess={() => { void queryClient.invalidateQueries({ queryKey: sessionKey }); }} />;
  }

  return <main className="min-h-screen bg-[#f6f3eb] text-[hsl(var(--foreground))]">
    <header className="border-b border-[hsl(var(--border))] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}corenexa-systems-logo-transparent.png`} alt="Corenexa Systems" className="h-9 w-32 object-contain object-left" />
          <span className="hidden h-8 border-l border-[hsl(var(--border))] sm:block" />
          <div className="min-w-0"><p className="truncate text-sm font-semibold">Pupil support workspace</p><p className="text-[10px] text-[hsl(var(--muted-foreground))]">Restricted cross-school access</p></div>
        </div>
        <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-xs font-semibold hover:bg-[hsl(var(--muted)/.45)] disabled:opacity-50" data-testid="button-support-logout"><LogOut className="size-4" /> Sign out</button>
      </div>
    </header>
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.2em] text-[hsl(var(--primary))]">Authorised support use only</p><h1 className="mt-2 font-display text-3xl tracking-[-.03em] sm:text-4xl">Find a pupil record</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Search by pupil name, guardian name, or registration number. Only the identity details needed to confirm a record are shown.</p></div>
        <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-white px-3 py-2 text-xs font-semibold hover:bg-[hsl(var(--muted)/.4)]"><ArrowLeft className="size-4" /> School sign in</Link>
      </div>

      <section className="rounded-3xl border border-[hsl(var(--border))] bg-white p-5 shadow-[0_12px_35px_rgba(27,67,57,.06)] sm:p-7">
        <label className="block max-w-2xl">
          <span className="mb-2 block text-xs font-semibold">Search all schools</span>
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