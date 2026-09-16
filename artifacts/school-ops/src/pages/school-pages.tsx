import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'wouter';
import type { AdmissionForm, Student, StudentUpdateInput, ReportCardInput, OperationSubject } from '@workspace/api-client-react';
import { AnnouncementInputPriority, AttendanceStatus, type AnnouncementInput, type SalaryPayment, type StudentInput, type AttendanceRecord, type Dashboard, type Payment, type PaymentInput, type TimetableInput, getAdmissionForm, useCreateAnnouncement, useCreateAttendanceRegister, useCreateReportCard, useCreateStudent, useCreateTimetableEntry, useGetAdmissionForm, useGetAttendance, useGetCurrentUser, useGetDashboard, useGetFinanceSummary, useGetOperations, useGetReportCard, useGetSettings, useGetStudent, useGetTimetable, useListAnnouncements, useListPayments, useListSalaries, useListStudents, useLogin, useRecordPayment, useSaveAttendance, useUpdatePayment, useUpdateSettings, useUpdateStudent, getGetAdmissionFormQueryKey, getGetAttendanceQueryKey, getGetDashboardQueryKey, getGetFinanceSummaryQueryKey, getGetOperationsQueryKey, getGetReportCardQueryKey, getGetSettingsQueryKey, getGetStudentQueryKey, getGetTimetableQueryKey, getListAnnouncementsQueryKey, getListPaymentsQueryKey, getListStudentsQueryKey } from '@workspace/api-client-react';
import { ArrowLeft, ArrowRight, BadgeCheck, BarChart3, BookOpen, CalendarDays, Check, ChevronDown, CircleDollarSign, ClipboardList, Download, Eye, EyeOff, FileBarChart, FileText, GraduationCap, Info, LockKeyhole, Megaphone, MoreHorizontal, Pencil, PhoneCall, Plus, Printer, Receipt, RefreshCcw, Search, Send, Share2, ShieldCheck, Upload, UserPlus, Users, WalletCards, X } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppShell, Button, EmptyState, ErrorState, PageHeader, Panel, SCHOOL_LOCATION, SCHOOL_NAME, SCHOOL_PHONE, SCHOOL_POSTAL_ADDRESS, SchoolMark, Skeleton } from '@/components/school-shell';
import { trackEvent } from '@/lib/analytics';

const currentCurrency = () => typeof window === 'undefined' ? 'UGX' : (document.documentElement.dataset.currency || window.localStorage.getItem('schoolops.currency') || 'UGX');
const money = (n = 0) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: currentCurrency(), maximumFractionDigits: 0 }).format(n);
const dateLabel = (value?: string) => value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
const todayLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
const pupilClassOptions = ['Baby Class', 'Middle Class', 'Top Class', 'Daycare', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Primary 7'];

function AdmissionDetailsFields({ form, update, declarationAccepted, onDeclarationChange }: {
  form: Record<string, string | boolean>;
  update: (key: string, value: string) => void;
  declarationAccepted: boolean;
  onDeclarationChange: (accepted: boolean) => void;
}) {
  return <div className="admission-official-sections space-y-3" data-testid="details-additional-admission">
    <p className="px-1 text-[11px] font-semibold uppercase tracking-[.14em] text-[#082f73]">Complete the remaining sections below</p>
    <div className="space-y-5">
    <div className="admission-section rounded-2xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--secondary)/.45)] p-4">
      <p className="admission-section-heading mb-2 text-xs font-semibold uppercase tracking-[.12em] text-[hsl(var(--primary))]">Previous fees</p>
      <p className="mb-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Because the school is in Term 3, record any unpaid balance carried forward from Terms 1 and 2. Leave it at zero when there is no previous balance.</p>
      <Field label="Previous terms balance (UGX)" type="number" value={String(form.previousFeeBalance || '')} onChange={(value) => update('previousFeeBalance', value)} placeholder="0" required={false} />
    </div>
    <div className="admission-section rounded-2xl border border-[hsl(var(--border))] p-4">
      <p className="admission-section-heading mb-4 text-xs font-semibold uppercase tracking-[.12em] text-[hsl(var(--primary))]">Pupil details</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Religion" value={String(form.religion || '')} onChange={(value) => update('religion', value)} placeholder="Religion" required={false} />
        <Field label="Place of birth" value={String(form.placeOfBirth || '')} onChange={(value) => update('placeOfBirth', value)} placeholder="Town, district, or country" required={false} />
        <Field label="Home village" value={String(form.homeVillage || '')} onChange={(value) => update('homeVillage', value)} placeholder="Village or parish" required={false} />
        <Field label="Nationality" value={String(form.nationality || '')} onChange={(value) => update('nationality', value)} placeholder="Ugandan" required={false} />
        <Field label="Tribe" value={String(form.tribe || '')} onChange={(value) => update('tribe', value)} placeholder="Tribe" required={false} />
      </div>
    </div>
    <div className="admission-section rounded-2xl border border-[hsl(var(--border))] p-4">
      <p className="admission-section-heading mb-4 text-xs font-semibold uppercase tracking-[.12em] text-[hsl(var(--primary))]">Parent or guardian details</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email address" type="email" value={String(form.guardianEmail || '')} onChange={(value) => update('guardianEmail', value)} placeholder="guardian@example.com" required={false} />
        <Field label="Relationship to pupil" value={String(form.guardianRelationship || '')} onChange={(value) => update('guardianRelationship', value)} placeholder="Parent, aunt, uncle..." required={false} />
        <Field label="National ID number" value={String(form.guardianNationalId || '')} onChange={(value) => update('guardianNationalId', value)} placeholder="National ID number" required={false} />
        <Field label="Residential address" value={String(form.residentialAddress || '')} onChange={(value) => update('residentialAddress', value)} placeholder="Home address" required={false} />
        <Field label="Occupation" value={String(form.guardianOccupation || '')} onChange={(value) => update('guardianOccupation', value)} placeholder="Occupation" required={false} />
        <Field label="Alternative contact" value={String(form.alternativeContact || '')} onChange={(value) => update('alternativeContact', value)} placeholder="Name and phone" required={false} />
      </div>
    </div>
    <div className="admission-section rounded-2xl border border-[hsl(var(--border))] p-4">
      <p className="admission-section-heading mb-4 text-xs font-semibold uppercase tracking-[.12em] text-[hsl(var(--primary))]">Section 3: Academic and medical information</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Previous school" value={String(form.previousSchool || '')} onChange={(value) => update('previousSchool', value)} placeholder="Write None if not applicable" required={false} />
        <Field label="Last class completed" value={String(form.lastClassCompleted || '')} onChange={(value) => update('lastClassCompleted', value)} placeholder="For example, Primary 2" required={false} />
        <Field label="Medical conditions or allergies" value={String(form.medicalConditions || '')} onChange={(value) => update('medicalConditions', value)} placeholder="Write None if not applicable" required={false} />
        <Field label="Special needs or disabilities" value={String(form.specialNeeds || '')} onChange={(value) => update('specialNeeds', value)} placeholder="Write None if not applicable" required={false} />
        <Field label="Known medical notes" value={String(form.knownMedicalNote || '')} onChange={(value) => update('knownMedicalNote', value)} placeholder="Medication or other notes" required={false} />
      </div>
    </div>
    <div className="admission-section rounded-2xl border border-[hsl(var(--border))] p-4">
      <p className="admission-section-heading mb-4 text-xs font-semibold uppercase tracking-[.12em] text-[hsl(var(--primary))]">Section 4: Emergency contact and declaration</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Emergency contact name" value={String(form.emergencyContactName || '')} onChange={(value) => update('emergencyContactName', value)} placeholder="Full name" required={false} />
        <Field label="Emergency contact phone" value={String(form.emergencyContactPhone || '')} onChange={(value) => update('emergencyContactPhone', value)} placeholder="+256 7..." required={false} />
        <Field label="Emergency contact relationship" value={String(form.emergencyContactRelationship || '')} onChange={(value) => update('emergencyContactRelationship', value)} placeholder="Relationship" required={false} />
      </div>
    </div>
    <div className="admission-section rounded-2xl bg-[hsl(var(--secondary)/.6)] p-4">
      <p className="admission-section-heading text-xs font-semibold uppercase tracking-[.12em] text-[hsl(var(--primary))]">Declaration</p>
      <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">I confirm that the information supplied on this admission form is correct and that I will notify the school of any changes.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Declaration date" type="date" value={String(form.declarationDate || '')} onChange={(value) => update('declarationDate', value)} required={false} />
        <label className="flex items-center gap-3 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3.5 text-sm">
          <input type="checkbox" checked={declarationAccepted} onChange={(event) => onDeclarationChange(event.target.checked)} className="size-4 accent-[hsl(var(--primary))]" data-testid="checkbox-declaration-accepted" />
          <span>I accept the declaration</span>
        </label>
      </div>
    </div>
    </div>
  </div>;
}

function AdmissionPaperHeader() {
  return <div className="admission-paper-header">
    <div className="flex items-center gap-3 sm:gap-5">
      <img src="/school-logo.jpg" alt={`${SCHOOL_NAME} crest`} className="size-20 shrink-0 object-contain sm:size-28" />
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <h2 className="font-display text-xl font-bold leading-tight text-[#062d72] sm:text-3xl">{SCHOOL_NAME}</h2>
        <p className="mt-1 text-xs font-semibold leading-5 text-[#062d72] sm:text-sm">{SCHOOL_POSTAL_ADDRESS} · Hoima City</p>
        <p className="text-xs font-semibold leading-5 text-[#062d72] sm:text-sm">Tel {SCHOOL_PHONE}</p>
        <p className="text-[10px] font-semibold leading-4 text-[#062d72] sm:text-xs">Located: {SCHOOL_LOCATION}</p>
      </div>
      <div className="admission-photo-box hidden h-28 w-24 shrink-0 sm:flex">
        <span className="text-center text-[10px] font-semibold leading-4 text-[#062d72]">Passport Photo<br />3×4 cm</span>
      </div>
    </div>
    <div className="mt-4 border-y-4 border-[#d5b51b] py-2 text-center">
      <h3 className="font-display text-2xl font-bold tracking-[.04em] text-[#062d72] sm:text-4xl">PUPIL ADMISSION FORM</h3>
    </div>
    <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[.12em] text-[#365276]">Please complete every section in order</p>
  </div>;
}

function Modal({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const modalTone = title === 'Register a student' ? ' admission-registration-form' : '';
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(var(--foreground)/.35)] p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" data-testid="modal-dialog"><div className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-2xl sm:rounded-3xl${modalTone} ${wide ? 'max-w-2xl' : 'max-w-lg'}`}><div className={`flex items-start justify-between gap-4 ${modalTone ? 'mb-2' : 'mb-6'}`}><div>{!modalTone && <><h2 className="font-display text-2xl">{title}</h2>{description && <p className="mt-1 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{description}</p>}</>}</div><button onClick={onClose} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]" data-testid="button-close-modal"><X className="size-4" /></button></div>{modalTone && <AdmissionPaperHeader />}{children}</div></div>;
}

function Field({ label, value, onChange, placeholder, type = 'text', required = true, autoComplete }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean; autoComplete?: string }) {
  const isRequired = label === 'Opening payment' || label === 'Date of birth' ? false : required;
  const [showPassword, setShowPassword] = useState(false);
  const passwordField = type === 'password';
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[hsl(var(--foreground))]">{label}{isRequired && <span className="text-[hsl(var(--destructive))]"> *</span>}{!isRequired && <span className="ml-1 font-normal text-[hsl(var(--muted-foreground))]">(optional)</span>}</span><span className="relative block"><input required={isRequired} type={passwordField && showPassword ? 'text' : type} min={type === 'number' ? 0 : undefined} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className={`focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3.5 text-sm text-[hsl(var(--foreground))] outline-none transition-colors placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] ${passwordField ? 'pr-12' : ''}`} data-testid={`input-${label.toLowerCase().replaceAll(' ', '-')}`} />{passwordField && <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="button-toggle-password">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>}</span></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[hsl(var(--foreground)/.78)]">{label}</span><div className="relative"><select value={value} onChange={(e) => onChange(e.target.value)} className="focus-ring h-11 w-full appearance-none rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3.5 pr-10 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid={`select-${label.toLowerCase().replaceAll(' ', '-')}`}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 size-4 text-[hsl(var(--muted-foreground))]" /></div></label>;
}

function LegacyLoginPage() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const [userType, setUserType] = useState<'staff' | 'learner'>('staff');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ data: { userType, identifier, password } }, {
      onSuccess: () => {
        trackEvent('login_success', { user_type: userType });
        setLocation('/dashboard');
      },
      onError: () => trackEvent('login_failed', { user_type: userType }),
    });
  };
  return <div className="min-h-[100dvh] bg-white text-[hsl(var(--foreground))]"><div className="mx-auto grid min-h-[100dvh] max-w-[1600px] md:grid-cols-[minmax(320px,.9fr)_minmax(420px,1.1fr)]"><section className="relative flex min-h-[270px] flex-col justify-center overflow-hidden border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.35)] px-6 py-10 sm:px-10 md:min-h-[100dvh] md:justify-start md:border-b-0 md:border-r md:px-12 md:py-16 lg:px-20"><div className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-[hsl(var(--primary)/.08)] blur-3xl" /><div className="pointer-events-none absolute -bottom-32 -right-20 size-96 rounded-full bg-[hsl(var(--accent)/.16)] blur-3xl" /><div className="relative z-10 w-full max-w-md rounded-[2rem] border border-[hsl(var(--border))] bg-white/75 p-6 shadow-[0_20px_60px_rgba(27,67,57,.08)] backdrop-blur-sm md:p-8"><div className="flex flex-col items-center text-center"><div className="flex h-44 w-full items-center justify-center md:h-52"><img src="/corenexa-systems-logo-transparent.png" alt="Corenexa Systems" className="h-full w-full object-contain" data-testid="img-corenexa-logo" /></div><div className="mt-3 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]"><p className="font-display text-xl text-[hsl(var(--foreground))]">Digital systems made for better work.</p><p className="mt-2">We design dependable systems and beautiful websites that help organisations work smarter, stay connected, and grow with confidence.</p><p className="mt-3">Need a hand? <Link href="/support" className="font-semibold text-[hsl(var(--primary))] underline decoration-[hsl(var(--primary)/.35)] underline-offset-4 hover:decoration-[hsl(var(--primary))]" data-testid="link-support">For support</Link><span className="mx-2 text-[hsl(var(--muted-foreground))]">·</span><Link href="/manual" className="font-semibold text-[hsl(var(--primary))] underline decoration-[hsl(var(--primary)/.35)] underline-offset-4 hover:decoration-[hsl(var(--primary))]" data-testid="link-user-manual-login">User manual</Link></p></div><div className="mt-7 w-full border-t border-[hsl(var(--border))] pt-7"><div className="flex items-center gap-4 text-left"><div className="flex h-32 w-32 shrink-0 items-center justify-center md:h-36 md:w-36"><img src="/school-logo.jpg" alt={`${SCHOOL_NAME} crest`} className="h-full w-full object-contain drop-shadow-sm" data-testid="img-school-logo" /></div><div className="min-w-0"><h1 className="font-display text-2xl leading-tight text-[hsl(var(--foreground))] md:text-3xl">{SCHOOL_NAME}</h1><div className="mt-4 border-t border-[hsl(var(--border))] pt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><p>{SCHOOL_POSTAL_ADDRESS}</p><p>{SCHOOL_PHONE}</p><p>{SCHOOL_LOCATION}</p></div></div></div></div></div></div></section><section className="flex items-center justify-center px-5 py-10 sm:px-10 md:px-12 lg:px-20"><div className="w-full max-w-[480px] animate-rise-in"><div className="mb-7"><p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.2em] text-[hsl(var(--primary))]">Secure school workspace</p><h1 className="mt-2 font-display text-4xl leading-none tracking-[-.035em] text-[hsl(var(--foreground))] sm:text-5xl">Welcome back</h1><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Sign in to manage pupils, staff, attendance, finance, and school operations.</p><div className="mt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))] sm:hidden">{SCHOOL_POSTAL_ADDRESS} · {SCHOOL_PHONE}</div></div><div className="rounded-3xl border border-[hsl(var(--border))] bg-white p-6 shadow-[0_20px_60px_rgba(27,67,57,.10)] sm:p-8"><div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-[hsl(var(--muted))] p-1.5"><button type="button" onClick={() => setUserType('staff')} className={`rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${userType === 'staff' ? 'scale-[1.02] bg-white text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground)/.8)]'}`} data-testid="button-role-staff">Staff & Teachers</button><button type="button" onClick={() => setUserType('learner')} className={`rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${userType === 'learner' ? 'scale-[1.02] bg-white text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground)/.8)]'}`} data-testid="button-role-learner">Pupils & Guardians</button></div><form onSubmit={submit} className="space-y-5"><Field label={userType === 'staff' ? 'Staff Username' : 'Registration Number'} value={identifier} onChange={setIdentifier} placeholder={userType === 'staff' ? 'Enter staff username' : 'Enter pupil or guardian registration number'} autoComplete="username" /><Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Enter your password" autoComplete="current-password" /><div className="flex items-center justify-between pt-1 text-xs"><label className="group flex cursor-pointer items-center gap-2 font-medium text-[hsl(var(--muted-foreground))]"><input type="checkbox" className="size-4 rounded-md accent-[hsl(var(--primary))] transition-transform group-hover:scale-110" data-testid="checkbox-remember" /> Remember device</label><button type="button" className="font-semibold text-[hsl(var(--primary))] transition-colors hover:text-[hsl(var(--primary)/.8)] hover:underline" data-testid="button-forgot-password">Forgot password?</button></div>{login.isError && <div className="animate-rise-in rounded-xl border border-[hsl(var(--destructive)/.28)] bg-[hsl(var(--destructive)/.08)] p-3 text-sm text-[hsl(var(--destructive))]" data-testid="status-login-error">We couldn’t sign you in. Check your details and try again.</div>}<Button type="submit" disabled={login.isPending} className="mt-2 min-h-[48px] w-full text-base" testId="button-sign-in">{login.isPending ? 'Verifying...' : 'Sign In'}{!login.isPending && <ArrowRight className="ml-1.5 size-4" />}</Button></form></div><div className="mt-6 flex items-center gap-2 text-xs font-medium text-[hsl(var(--muted-foreground))]"><LockKeyhole className="size-3.5 text-[hsl(var(--primary))]" /> Protected by Corenexa Systems · {SCHOOL_LOCATION}</div></div></section></div></div>;
}

function LoginPage() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const [userType, setUserType] = useState<'staff' | 'learner'>('staff');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ data: { userType, identifier, password } }, {
      onSuccess: () => {
        trackEvent('login_success', { user_type: userType });
        setLocation('/dashboard');
      },
      onError: () => trackEvent('login_failed', { user_type: userType }),
    });
  };
  return <div className="min-h-[100dvh] bg-[#f6f3eb] text-[hsl(var(--foreground))]">
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      <section className="flex min-h-[430px] flex-col justify-between px-8 py-12 sm:px-14 md:px-20 lg:min-h-[100dvh] lg:px-[12%] lg:py-16" data-testid="login-brand-panel">
        <div className="mx-auto w-full max-w-md">
          <img src="/corenexa-systems-logo-transparent.png" alt="Corenexa Systems" className="h-28 w-full object-contain object-left sm:h-36" data-testid="img-corenexa-logo" />
          <h1 className="mt-10 max-w-sm font-display text-4xl leading-[1.08] tracking-[-.04em] sm:text-5xl">Digital systems made for better work.</h1>
          <p className="mt-7 max-w-md text-base leading-7 text-[hsl(var(--foreground)/.82)]">CoreNexa provides modern, reliable, and secure digital platforms designed to streamline operations, boost productivity, and help teams work smarter with confidence.</p>
          <div className="mt-14 text-sm leading-7 text-[hsl(var(--muted-foreground))]"><p className="flex items-center gap-2 font-semibold text-[hsl(var(--foreground)/.8)]"><LockKeyhole className="size-4 text-[hsl(var(--primary))]" /> Need help?</p><ul className="mt-2 list-disc space-y-0.5 pl-6"><li><Link href="/support" className="text-[hsl(var(--primary))] hover:underline" data-testid="link-support">For support</Link></li><li><Link href="/manual" className="text-[hsl(var(--primary))] hover:underline" data-testid="link-user-manual-login">User manual</Link></li><li>Contact: support@corenexa.com</li></ul></div>
        </div>
        <p className="mx-auto mt-12 w-full max-w-md text-xs text-[hsl(var(--muted-foreground))]">© 2024 CoreNexa Systems. All rights reserved.</p>
      </section>
      <section className="flex items-center justify-center bg-white px-6 py-12 sm:px-12 lg:px-[12%] lg:py-16" data-testid="login-form-panel">
        <div className="w-full max-w-[430px] animate-rise-in">
          <div className="mb-8"><p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.22em] text-[hsl(var(--primary))]">Secure school workspace</p><h2 className="mt-3 font-display text-4xl leading-none tracking-[-.04em] sm:text-5xl">Welcome back</h2></div>
          <div className="rounded-3xl border border-[hsl(var(--border))] bg-white p-5 shadow-[0_20px_60px_rgba(27,67,57,.10)] sm:p-7">
            <div className="flex items-center gap-4 border-b border-[hsl(var(--border))] pb-5"><img src="/school-logo.jpg" alt={`${SCHOOL_NAME} crest`} className="size-16 shrink-0 object-contain sm:size-[76px]" data-testid="img-school-logo" /><div className="min-w-0"><h3 className="font-display text-lg leading-tight sm:text-xl">{SCHOOL_NAME}</h3><div className="mt-2 text-[10px] leading-4 text-[hsl(var(--muted-foreground))]"><p>{SCHOOL_POSTAL_ADDRESS} · {SCHOOL_PHONE}</p><p>{SCHOOL_LOCATION}</p></div></div></div>
            <div className="my-6 grid grid-cols-2 gap-2 rounded-2xl bg-[hsl(var(--muted))] p-1.5"><button type="button" onClick={() => setUserType('staff')} className={`rounded-xl py-2.5 text-xs font-semibold transition-all sm:text-sm ${userType === 'staff' ? 'scale-[1.02] bg-white text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground)/.8)]'}`} data-testid="button-role-staff">Staff & Teachers</button><button type="button" onClick={() => setUserType('learner')} className={`rounded-xl py-2.5 text-xs font-semibold transition-all sm:text-sm ${userType === 'learner' ? 'scale-[1.02] bg-white text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground)/.8)]'}`} data-testid="button-role-learner">Pupils & Guardians</button></div>
            <form onSubmit={submit} className="space-y-5"><Field label={userType === 'staff' ? 'Staff Username' : 'Registration Number'} value={identifier} onChange={setIdentifier} placeholder={userType === 'staff' ? 'Enter staff username' : 'Enter pupil or guardian registration number'} autoComplete="username" /><Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Enter your password" autoComplete="current-password" /><div className="flex items-center justify-between pt-1 text-xs"><label className="group flex cursor-pointer items-center gap-2 font-medium text-[hsl(var(--muted-foreground))]"><input type="checkbox" className="size-4 rounded-md accent-[hsl(var(--primary))]" data-testid="checkbox-remember" /> Remember device</label><button type="button" className="font-semibold text-[hsl(var(--primary))] hover:underline" data-testid="button-forgot-password">Forgot password?</button></div>{login.isError && <div className="rounded-xl border border-[hsl(var(--destructive)/.28)] bg-[hsl(var(--destructive)/.08)] p-3 text-sm text-[hsl(var(--destructive))]" data-testid="status-login-error">We couldn’t sign you in. Check your details and try again.</div>}<Button type="submit" disabled={login.isPending} className="mt-2 min-h-[48px] w-full text-base" testId="button-sign-in">{login.isPending ? 'Verifying…' : 'Sign In'}{!login.isPending && <ArrowRight className="ml-1.5 size-4" />}</Button></form>
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs font-medium text-[hsl(var(--muted-foreground))]"><LockKeyhole className="size-3.5 text-[hsl(var(--primary))]" /> Protected by Corenexa Systems · Secure SSL connection</p>
        </div>
      </section>
    </div>
  </div>;
}

function LegacyDashboardPage() {
  const { data, isLoading, isError, refetch } = useGetDashboard();
  const { data: timetable } = useGetTimetable();
  const dashboard = data as Dashboard | undefined;
  const summary = dashboard?.summary;
  const summaryCards: { label: string; value: string | number | undefined; Icon: typeof Users; color: string }[] = [
    { label: 'Pupils', value: summary?.students, Icon: Users, color: 'text-[hsl(var(--primary))]' },
    { label: 'Attendance today', value: `${summary?.attendance ?? 0}%`, Icon: CalendarDays, color: 'text-[hsl(var(--chart-3))]' },
    { label: 'Fees collected', value: money(summary?.feesCollected), Icon: CircleDollarSign, color: 'text-[hsl(var(--chart-2))]' },
    { label: 'Outstanding fees', value: money(summary?.outstandingFees), Icon: WalletCards, color: 'text-[hsl(var(--chart-4))]' },
  ];
  return <AppShell><PageHeader eyebrow={todayLabel} title={dashboard?.greeting || 'Good morning'} description="Here’s the shape of the school day. A few things need your attention." action={<Button testId="button-dashboard-refresh" variant="secondary" onClick={() => refetch()}><RefreshCcw className="size-4" /> Refresh</Button>} />{isError ? <Panel><ErrorState onRetry={() => refetch()} /></Panel> : isLoading ? <DashboardSkeleton /> : <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{summaryCards.map(({ label, value, Icon, color }, index) => <Panel key={label} className={`animate-rise-in delay-${index + 1} p-5`} testId={`card-summary-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="flex items-start justify-between"><span className="text-sm text-[hsl(var(--muted-foreground))]">{label}</span><span className={`flex size-9 items-center justify-center rounded-xl bg-[hsl(var(--muted))] ${color}`}><Icon className="size-[18px]" /></span></div><p className="mt-5 font-display text-3xl tracking-tight" data-testid={`text-summary-${label.toLowerCase().replaceAll(' ', '-')}`}>{value ?? '—'}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{label === 'Outstanding fees' ? 'Across active accounts' : 'Updated just now'}</p></Panel>)}</div><div className="grid gap-6 xl:grid-cols-[1.45fr_.8fr]"><Panel className="overflow-hidden" testId="panel-attendance-trend"><div className="flex items-start justify-between border-b border-[hsl(var(--border))] p-5 md:p-6"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">This week</p><h2 className="mt-1 font-display text-2xl">Attendance pulse</h2></div><Link href="/attendance" data-testid="link-dashboard-attendance" className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline">Open register <ArrowRight className="ml-1 inline size-3" /></Link></div><div className="p-5 md:p-6">{dashboard?.attendanceTrend?.length ? <div className="flex h-52 items-end gap-3 sm:gap-7">{dashboard.attendanceTrend.map((day, index) => <div className="flex flex-1 flex-col items-center gap-3" key={day.day} data-testid={`chart-attendance-${index}`}><div className="flex h-40 w-full max-w-12 items-end gap-1"><div className="w-1/2 rounded-t-md bg-[hsl(var(--primary))]" style={{ height: `${Math.max(12, day.present)}%` }} /><div className="w-1/2 rounded-t-md bg-[hsl(var(--chart-4)/.55)]" style={{ height: `${Math.max(8, day.absent * 3)}%` }} /></div><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{day.day}</span></div>)}</div> : <EmptyState icon={BarChart3} title="No attendance trend yet" description="Once registers are marked, your week will start to take shape here." />}</div><div className="flex gap-5 border-t border-[hsl(var(--border))] px-6 py-3 text-[11px] text-[hsl(var(--muted-foreground))]"><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[hsl(var(--primary))]" />Present</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[hsl(var(--chart-4)/.55)]" />Absent</span></div></Panel><Panel testId="panel-upcoming"><div className="border-b border-[hsl(var(--border))] p-5"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">On the horizon</p><h2 className="mt-1 font-display text-2xl">Upcoming</h2></div><div className="divide-y divide-[hsl(var(--border))]">{dashboard?.upcomingEvents?.length ? dashboard.upcomingEvents.map((event, index) => <div className="flex gap-3 p-5 transition-colors hover:bg-[hsl(var(--muted)/.55)]" key={`${event.title}-${index}`} data-testid={`event-${index}`}><div className="flex size-9 shrink-0 flex-col items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><span className="font-mono-ui text-[9px]">{event.date.split(' ')[0]}</span><CalendarDays className="mt-0.5 size-3.5" /></div><div><p className="text-sm font-semibold">{event.title}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{event.date} · {event.type}</p></div></div>) : <EmptyState icon={CalendarDays} title="A clear calendar" description="There are no upcoming school events to show." />}</div></Panel></div><div className="grid gap-6 lg:grid-cols-2"><Panel testId="panel-recent-admissions"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-5"><h2 className="font-display text-2xl">Recent admissions</h2><Link href="/students" data-testid="link-dashboard-students" className="text-xs font-semibold text-[hsl(var(--primary))]">View directory <ArrowRight className="ml-1 inline size-3" /></Link></div>{dashboard?.recentAdmissions?.length ? <div className="divide-y divide-[hsl(var(--border))]">{dashboard.recentAdmissions.slice(0, 4).map((student) => <Link href={`/students/${student.id}`} key={student.id} data-testid={`link-recent-student-${student.id}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-[hsl(var(--muted)/.55)]"><span className="flex size-9 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-xs font-bold text-[hsl(var(--primary))]">{student.firstName[0]}{student.lastName[0]}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{student.name}</span><span className="block text-xs text-[hsl(var(--muted-foreground))]">{student.registrationNumber} · {student.className} {student.stream}</span></span><ArrowRight className="size-4 text-[hsl(var(--muted-foreground))]" /></Link>)}</div> : <EmptyState icon={UserPlus} title="No recent admissions" description="Newly registered students will appear here." />}</Panel><Panel testId="panel-next-class"><div className="border-b border-[hsl(var(--border))] p-5"><h2 className="font-display text-2xl">Next on your timetable</h2></div>{timetable?.slice(0, 3).map((entry) => <div key={entry.id} className="flex items-center gap-4 border-b border-[hsl(var(--border))] p-4 last:border-b-0"><span className="w-16 font-mono-ui text-[10px] text-[hsl(var(--primary))]">{entry.time}</span><span className="h-8 w-1 rounded-full" style={{ backgroundColor: entry.accent || 'hsl(var(--primary))' }} /><span className="flex-1"><span className="block text-sm font-semibold">{entry.subject}</span><span className="text-xs text-[hsl(var(--muted-foreground))]">{entry.className} · {entry.room}</span></span></div>) || <EmptyState icon={BookOpen} title="Your timetable is quiet" description="Assigned classes will appear here." />}</Panel></div></div>}</AppShell>;
}

function SupportPage() {
  return <div className="min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-8 text-[hsl(var(--foreground))] sm:px-8 sm:py-12"><div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl items-center justify-center"><div className="grid w-full overflow-hidden rounded-[2rem] border border-[hsl(var(--border))] bg-white shadow-[0_24px_80px_rgba(27,67,57,.12)] md:grid-cols-[.9fr_1.1fr]"><section className="flex flex-col items-center justify-center bg-[hsl(var(--secondary)/.45)] p-8 text-center sm:p-12"><img src="/corenexa-systems-logo-transparent.png" alt="Corenexa Systems" className="h-36 w-full max-w-xs object-contain" /><p className="mt-6 font-display text-2xl">We make digital work feel simpler.</p><p className="mt-3 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">Corenexa Systems designs dependable systems and beautiful websites that give organisations clearer workflows, stronger connections, and room to grow.</p></section><section className="p-8 sm:p-12"><div className="flex flex-wrap gap-4"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--primary))] hover:underline" data-testid="link-back-login"><ArrowLeft className="size-4" /> Back to login</Link><Link href="/manual" className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--primary))] hover:underline" data-testid="link-user-manual-support"><BookOpen className="size-4" /> User manual</Link></div><p className="mt-10 font-mono-ui text-[10px] font-semibold uppercase tracking-[.2em] text-[hsl(var(--primary))]">Corenexa support</p><h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">We’re here to help.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Whether you need help with a school system, a website, or a new digital idea, our team is ready to listen and help you take the next step.</p><div className="mt-8 grid gap-4 sm:grid-cols-2"><a href="tel:+256786384483" className="group rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/.5)] hover:shadow-lg" data-testid="link-support-primary"><span className="flex size-10 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><PhoneCall className="size-5" /></span><span className="mt-5 block text-xs font-semibold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Support line one</span><span className="mt-1 block font-mono-ui text-lg font-semibold text-[hsl(var(--foreground))]">0786384483</span></a><a href="tel:+256792834165" className="group rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/.5)] hover:shadow-lg" data-testid="link-support-secondary"><span className="flex size-10 items-center justify-center rounded-xl bg-[hsl(var(--accent)/.45)] text-[hsl(var(--accent-foreground))]"><PhoneCall className="size-5" /></span><span className="mt-5 block text-xs font-semibold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Support line two</span><span className="mt-1 block font-mono-ui text-lg font-semibold text-[hsl(var(--foreground))]">0792834165</span></a></div><div className="mt-8 rounded-2xl bg-[hsl(var(--muted)/.65)] p-5 text-sm leading-6 text-[hsl(var(--muted-foreground))]"><p className="font-semibold text-[hsl(var(--foreground))]">Need a complete digital solution?</p><p className="mt-1">From school management systems to responsive websites, Corenexa Systems builds practical digital products with thoughtful design and reliable support.</p></div></section></div></div></div>;
}

const manualRoles: Record<string, { title: string; summary: string; steps: string[] }> = {
  administrator: { title: 'Administrator workflow', summary: 'Follow these steps from the dashboard to set up the school and run the day-to-day work.', steps: ['Start on Dashboard and open User manual whenever you need the guided steps for your role.', 'Open Settings and confirm the academic year, school details, and UGX currency before registering records.', 'Open Students and register each pupil with the correct class, fees, guardian details, and passport photo when available.', 'Open Operations → Classes to check classes and streams, then use Register a subject to attach each subject to its class.', 'Use Attendance for daily registers, Finance for payments and receipts, and Operations for expenses, salaries, reports, and documents.', 'Review the dashboard, audit records, receipts, and salary documents regularly; use the approved backup process before major changes.'] },
  super_admin: { title: 'Administrator workflow', summary: 'Set up the school and review every core operation.', steps: ['Open Settings first and confirm the academic year and UGX currency.', 'Register pupils and confirm the existing staff roster is correct before beginning daily operations.', 'Use Dashboard for daily review, Finance for pupil payments, and Operations for expenses, salaries, reports, and records.', 'Review transactions and salary receipts regularly, then use the school’s approved backup process before major changes.'] },
  teacher: { title: 'Teacher workflow', summary: 'Use the dashboard to move through your assigned classes, attendance, assignments, and timetable.', steps: ['Start on Dashboard and open User manual to review this teacher guide.', 'Open Operations → Classes to confirm the classes and subjects assigned to you.', 'Open Attendance, choose an assigned class, and mark active pupils present, absent, or late with arrival times.', 'Open Operations → Assignments to create and follow up work for your assigned pupils.', 'Check Timetable and Announcements at the start of each school day, then report access problems to an administrator.'] },
  accountant: { title: 'Accountant workflow', summary: 'Use the dashboard to record collections, expenses, salaries, and complete receipt history.', steps: ['Start on Dashboard and open User manual for the finance steps.', 'Open Finance, select the pupil, confirm the registration number and balance, and record the payment.', 'Open Transactions to print, download, or share the receipt with its balance and payment history.', 'Open Operations → Expenses for Posho, Beans, Electricity, Firewood, or another approved category.', 'Open Operations → Salaries, select a registered teacher or staff member, and complete the salary record.', 'Check the receipt number, date, method, remaining balance, and daily totals before closing.'] },
  staff: { title: 'Staff workflow', summary: 'Use the records and school operations available to your assigned permissions.', steps: ['Start on Dashboard for the day’s notices and school pulse.', 'Use the navigation items provided for your role; unavailable areas are intentionally restricted.', 'Create or update operational records only when the information is complete and accurate.', 'Open Announcements and Timetable regularly for school-wide changes.', 'Use My profile to confirm your contact information and contact an administrator for permission changes.'] },
  guardian: { title: 'Guardian workflow', summary: 'Follow your child’s learning, notices, timetable, and fee information.', steps: ['Sign in with the permanent registration number linked to your guardian account.', 'Open My child to review the pupil profile, balance, and report card.', 'Check Assignments, Timetable, Announcements, and Notifications regularly.', 'Contact the school office if the linked pupil or registration number is incorrect.', 'Keep your login details private and sign out on shared devices.'] },
  student: { title: 'Pupil workflow', summary: 'Keep track of learning tasks, timetable, notices, and your report card.', steps: ['Sign in with your permanent registration number.', 'Open My learning for your pupil profile and current school information.', 'Check Assignments and Timetable before lessons and Announcements for updates.', 'Ask a teacher or guardian for help if your account details are incorrect.', 'Sign out on shared computers.'] },
};

function ManualContent({ role }: { role?: string }) {
  const guidance = manualRoles[role || 'staff'] || manualRoles.staff;
  const isSignedIn = Boolean(role);
  return <div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.2em] text-[hsl(var(--primary))]">EMMECTY help centre</p><h1 className="mt-2 font-display text-4xl leading-none tracking-[-.035em] md:text-5xl">User manual</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">A practical guide for using the school management system safely and consistently.</p></div><div className="flex flex-wrap gap-2">{isSignedIn ? <Button variant="secondary" onClick={() => window.print()} testId="button-print-user-manual"><Printer className="size-4" /> Print manual</Button> : <Link href="/"><Button variant="secondary" testId="button-manual-login">Back to login</Button></Link>}</div></div><Panel className="overflow-hidden" testId="panel-manual-role"><div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.45)] p-6"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><BookOpen className="size-5" /></span><div><h2 className="font-display text-2xl">{guidance.title}</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{guidance.summary}</p></div></div></div><ol className="grid gap-4 p-6 md:grid-cols-2">{guidance.steps.map((step, index) => <li key={step} className="flex gap-3 rounded-2xl border border-[hsl(var(--border))] p-4"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-xs font-bold text-[hsl(var(--primary-foreground))]">{index + 1}</span><p className="text-sm leading-6">{step}</p></li>)}</ol></Panel><div className="grid gap-6 lg:grid-cols-2"><Panel className="p-6" testId="panel-manual-quick-start"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-[hsl(var(--accent)/.45)] text-[hsl(var(--accent-foreground))]"><Check className="size-5" /></span><div><h2 className="font-display text-2xl">First-day checklist</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Complete these before regular school operations begin.</p></div></div><ul className="mt-5 space-y-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{['Confirm the school year and currency in Settings.', 'Register pupils with correct names, class, fees, and registration numbers.', 'Create accounts with unique usernames or permanent registration numbers.', 'Register monthly salaries before making salary payments.', 'Create classes, teacher assignments, attendance registers, and timetable entries.', 'Make one test receipt and verify the printed school document before live collections.'].map((item) => <li key={item} className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-[hsl(var(--primary))]" />{item}</li>)}</ul></Panel><Panel className="p-6" testId="panel-manual-safety"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><ShieldCheck className="size-5" /></span><div><h2 className="font-display text-2xl">Safe daily practice</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Protect the school’s records and keep an audit trail.</p></div></div><ul className="mt-5 space-y-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{['Use one account per person; never share passwords.', 'Give finance, expense, and class permissions only to people who need them.', 'Confirm pupil registration numbers and receipt numbers before handing over documents.', 'Review payment, salary, expense, and attendance records at the end of each day.', 'Use the approved school backup process and test restoration before relying on a backup.', 'Contact the administrator or support team when a record needs correction; do not create a duplicate to hide an error.'].map((item) => <li key={item} className="flex gap-2"><ShieldCheck className="mt-1 size-4 shrink-0 text-[hsl(var(--primary))]" />{item}</li>)}</ul></Panel></div><Panel className="p-6" testId="panel-manual-help"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-2xl">Need more help?</h2><p className="mt-1 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Use the support page for Corenexa contact details or ask your school administrator to update your access.</p></div><Link href="/support"><Button variant="secondary" testId="button-manual-support"><PhoneCall className="size-4" /> Contact support</Button></Link></div></Panel></div>;
}

function UserManualPage() {
  const { data: session } = useGetCurrentUser();
  const content = <ManualContent role={session?.user.role} />;
  return session?.user ? <AppShell>{content}</AppShell> : <LoginPage />;
}

const pdfEscape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
type PdfImage = { bytes: Uint8Array; width: number; height: number };
let schoolLogoPromise: Promise<PdfImage | undefined> | undefined;
const loadSchoolLogo = () => {
  schoolLogoPromise ??= fetch('/school-logo.jpg').then(async (response) => {
    if (!response.ok) return undefined;
    return { bytes: new Uint8Array(await response.arrayBuffer()), width: 177, height: 182 };
  }).catch(() => undefined);
  return schoolLogoPromise;
};
const loadPupilPhoto = async (photoPath?: string) => {
  if (!photoPath?.startsWith('/objects/')) return undefined;
  try {
    const response = await fetch(`/api/storage${photoPath}`);
    if (!response.ok) return undefined;
    return { bytes: new Uint8Array(await response.arrayBuffer()), width: 240, height: 300 };
  } catch {
    return undefined;
  }
};
const normalizePupilPhoto = async (file: File) => {
  if (file.type === 'image/jpeg') return file;
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Unable to read image'));
      element.src = objectUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d')?.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Unable to convert image')), 'image/jpeg', 0.92));
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
export async function brandedPdf(lines: string[], photoPath?: string) {
  const logo = await loadSchoolLogo();
  const photo = await loadPupilPhoto(photoPath);
  const encoder = new TextEncoder();
  const wrappedLines = lines.flatMap((line) => {
    const value = String(line);
    if (value.length <= 82) return [value];
    const chunks: string[] = [];
    for (let index = 0; index < value.length; index += 82) chunks.push(value.slice(index, index + 82));
    return chunks;
  });
  const headerLines = [SCHOOL_NAME, SCHOOL_POSTAL_ADDRESS, `Tel: ${SCHOOL_PHONE}`, SCHOOL_LOCATION, ''];
  const pageSize = logo ? 20 : 23;
  const bodyPageSize = pageSize - headerLines.length;
  const pages = Array.from({ length: Math.max(1, Math.ceil(wrappedLines.length / bodyPageSize)) }, (_, index) => [...headerLines, ...wrappedLines.slice(index * bodyPageSize, (index + 1) * bodyPageSize)]);
  const photoObjectNumber = logo ? 5 : 4;
  const firstPageObject = 4 + (logo ? 1 : 0) + (photo ? 1 : 0);
  const pageObjects = pages.map((_, index) => firstPageObject + index * 2);
  const objects: { text: string; binary?: Uint8Array; after?: string }[] = [
    { text: '<< /Type /Catalog /Pages 2 0 R >>' },
    { text: `<< /Type /Pages /Kids [${pageObjects.map((objectNumber) => `${objectNumber} 0 R`).join(' ')}] /Count ${pages.length} >>` },
    { text: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' },
    ...(logo ? [{ text: `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`, binary: logo.bytes, after: '\nendstream' }] : []),
    ...(photo ? [{ text: `<< /Type /XObject /Subtype /Image /Width ${photo.width} /Height ${photo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${photo.bytes.length} >>\nstream\n`, binary: photo.bytes, after: '\nendstream' }] : []),
  ];
  pages.forEach((pageLines, index) => {
    const contentObjectNumber = firstPageObject + index * 2 + 1;
    const stream = [
       ...(logo ? ['q', '90 0 0 92 50 660 cm', '/Im1 Do', 'Q'] : []),
       ...(photo ? ['q', '72 0 0 90 480 600 cm', '/PupilPhoto Do', 'Q'] : []),
      'BT',
      logo ? '/F1 15 Tf\n175 740 Td' : '/F1 15 Tf\n50 744 Td',
      ...pageLines.flatMap((line, lineIndex) => [`(${pdfEscape(line)}) Tj`, ...(lineIndex < pageLines.length - 1 ? ['0 -30 Td', '/F1 10 Tf'] : [])]),
      'ET',
    ].join('\n');
    objects.push({
      text: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >>${logo || photo ? ` /XObject <<${logo ? ' /Im1 4 0 R' : ''}${photo ? ` /PupilPhoto ${photoObjectNumber} 0 R` : ''} >>` : ''} >> /Contents ${contentObjectNumber} 0 R >>`,
    });
    objects.push({ text: `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream` });
  });
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteLength = 0;
  const addText = (text: string) => {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    byteLength += bytes.length;
  };
  const addBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    byteLength += bytes.length;
  };
  addText('%PDF-1.4\n');
  objects.forEach((object, index) => {
    offsets.push(byteLength);
    addText(`${index + 1} 0 obj\n${object.text}`);
    if (object.binary) addBytes(object.binary);
    addText(`${object.after ? `${object.after}\n` : '\n'}endobj\n`);
  });
  const xref = byteLength;
  addText(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks.map((chunk) => chunk.slice().buffer), { type: 'application/pdf' });
}
async function thermalReceiptPdf(lines: string[]) {
  const logo = await loadSchoolLogo();
  const encoder = new TextEncoder();
  const wrappedLines = lines.flatMap((line) => {
    const value = String(line);
    if (value.length <= 34) return [value];
    const chunks: string[] = [];
    for (let index = 0; index < value.length; index += 34) chunks.push(value.slice(index, index + 34));
    return chunks;
  });
  const pageHeight = Math.max(520, 188 + wrappedLines.length * 16);
  const firstPageObject = logo ? 5 : 4;
  const objects: { text: string; binary?: Uint8Array; after?: string }[] = [
    { text: '<< /Type /Catalog /Pages 2 0 R >>' },
    { text: `<< /Type /Pages /Kids [${firstPageObject} 0 R] /Count 1 >>` },
    { text: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' },
    ...(logo ? [{ text: `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`, binary: logo.bytes, after: '\nendstream' }] : []),
  ];
  const stream = [
    ...(logo ? ['q', '62 0 0 64 82', `${pageHeight - 82} cm`, '/Im1 Do', 'Q'] : []),
    'BT',
    logo ? `/F1 10 Tf\n24 ${pageHeight - 102} Td` : `/F1 10 Tf\n24 ${pageHeight - 42} Td`,
    ...wrappedLines.flatMap((line, index) => [`(${pdfEscape(line)}) Tj`, ...(index < wrappedLines.length - 1 ? ['0 -16 Td'] : [])]),
    'ET',
  ].join('\n');
  objects.push({ text: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 226 ${pageHeight}] /Resources << /Font << /F1 3 0 R >>${logo ? ' /XObject << /Im1 4 0 R >>' : ''} >> /Contents ${firstPageObject + 1} 0 R >>` });
  objects.push({ text: `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream` });
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteLength = 0;
  const addText = (text: string) => {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    byteLength += bytes.length;
  };
  const addBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    byteLength += bytes.length;
  };
  addText('%PDF-1.4\n');
  objects.forEach((object, index) => {
    offsets.push(byteLength);
    addText(`${index + 1} 0 obj\n${object.text}`);
    if (object.binary) addBytes(object.binary);
    addText(`${object.after ? `${object.after}\n` : '\n'}endobj\n`);
  });
  const xref = byteLength;
  addText(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks.map((chunk) => chunk.slice().buffer), { type: 'application/pdf' });
}
async function receiptPdf(item: Payment, history: Payment[] = []) {
  return thermalReceiptPdf([
    SCHOOL_NAME,
    'OFFICIAL PAYMENT RECEIPT',
    `Receipt no: ${item.receiptNumber}`,
    `Pupil: ${item.studentName}`,
    `Reg. no: ${item.registrationNumber}`,
    `Amount paid: ${money(item.amount)}`,
    `Method: ${item.method}`,
    `Date: ${item.date}`,
    `Status: ${item.status}`,
    `Balance due: ${money(item.balance)}`,
    'Payment history:',
    ...history.map((payment) => `${payment.date} · ${payment.receiptNumber} · ${money(payment.amount)}`),
    "Thank you for supporting the pupil's education.",
  ]);
}
function addPrintLogo(printWindow: Window) {
  const header = printWindow.document.querySelector('header');
  if (!header) return;
  const logo = printWindow.document.createElement('img');
  logo.src = '/school-logo.jpg';
  logo.alt = 'EMMECTY Nursery & Primary School logo';
  logo.style.cssText = 'width:84px;height:86px;object-fit:contain;float:right;margin-left:20px';
  header.prepend(logo);
}
const admissionValue = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text || 'N/A';
};
const htmlEscape = (value: unknown) => admissionValue(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
const schoolPrintHeader = (subtitle: string) => `<header><img src="/school-logo.jpg" alt="${htmlEscape(SCHOOL_NAME)} crest"><div><h1>${htmlEscape(SCHOOL_NAME)}</h1><p>${htmlEscape(SCHOOL_POSTAL_ADDRESS)} · Tel: ${htmlEscape(SCHOOL_PHONE)}</p><p>${htmlEscape(SCHOOL_LOCATION)}</p><strong>${htmlEscape(subtitle)}</strong></div></header>`;
function receiptPrintPage(item: Payment, history: Payment[] = []) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const row = (label: string, value: string) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  printWindow.document.write(`<html><head><title>${htmlEscape(item.receiptNumber)}</title><style>@page{size:80mm auto;margin:0}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17231f;width:72mm;margin:0 auto;padding:5mm 0;font-size:11px}header{display:block;text-align:center;border-bottom:1px dashed #17231f;padding-bottom:4mm;margin-bottom:4mm;min-height:0}header img{display:block;width:22mm;height:22mm;object-fit:contain;margin:0 auto 2mm}header h1{font-size:13px;line-height:1.2;margin:0 0 1mm}header p{font-size:9px;margin:1mm 0;color:#63756e}header strong{display:block;margin-top:2mm;font-size:11px}dl{display:block;margin:0}dl>div{display:flex;justify-content:space-between;gap:3mm;border-bottom:1px dotted #b9c4bf;padding:2mm 0}dt{font-size:9px;color:#63756e;text-transform:uppercase}dd{font-size:11px;font-weight:600;margin:0;text-align:right;max-width:45mm;overflow-wrap:anywhere}.amount{font-size:16px;color:#1d7056}h2{font-size:11px;margin:5mm 0 2mm;border-bottom:1px solid #17231f;padding-bottom:1mm}table{width:100%;border-collapse:collapse;font-size:9px}th,td{text-align:left;padding:1.5mm 0;border-bottom:1px dotted #b9c4bf}th:last-child,td:last-child{text-align:right}.receipt-thanks{text-align:center;border-top:1px dashed #17231f;margin-top:6mm;padding-top:4mm;font-size:9px;color:#63756e}@media print{body{padding-top:3mm}}</style></head><body>${schoolPrintHeader(`Official payment receipt · ${item.receiptNumber}`)}<dl>${row('Pupil', htmlEscape(item.studentName))}${row('Registration no.', htmlEscape(item.registrationNumber))}${row('Amount paid', `<span class="amount">${htmlEscape(money(item.amount))}</span>`)}${row('Payment method', htmlEscape(item.method))}${row('Date', htmlEscape(item.date))}${row('Status', htmlEscape(item.status))}${row('Balance due', htmlEscape(money(item.balance)))}</dl><h2>Payment history</h2><table><thead><tr><th>Date</th><th>Receipt</th><th>Amount</th></tr></thead><tbody>${history.map((payment) => `<tr><td>${htmlEscape(payment.date)}</td><td>${htmlEscape(payment.receiptNumber)}</td><td>${htmlEscape(money(payment.amount))}</td></tr>`).join('')}</tbody></table><p class="receipt-thanks">This is an official EMMECTY school payment record.</p></body></html>`);
   printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function admissionFormPdf(form: AdmissionForm) {
  return brandedPdf([
    'OFFICIAL PUPIL ADMISSION FORM',
    `Registration number: ${form.registrationNumber}`,
    `Pupil: ${form.pupilName}`,
    `Date of birth: ${admissionValue(form.dateOfBirth)}`,
    `Gender: ${admissionValue(form.gender)}`,
    `Class: ${admissionValue(form.className)}${form.stream ? ` · ${form.stream}` : ''}`,
    'Passport photo holder: 3 cm x 4 cm',
    `Religion: ${admissionValue(form.religion)}`,
    `Place of birth: ${admissionValue(form.placeOfBirth)}`,
    `Home village: ${admissionValue(form.homeVillage)}`,
    `Nationality: ${admissionValue(form.nationality)}`,
    `Tribe: ${admissionValue(form.tribe)}`,
    `Guardian: ${admissionValue(form.guardianName)}`,
    `Guardian contact: ${admissionValue(form.guardianPhone)}`,
    `Guardian email: ${admissionValue(form.guardianEmail)}`,
    `Relationship: ${admissionValue(form.guardianRelationship)}`,
    `National ID: ${admissionValue(form.guardianNationalId)}`,
    `Residential address: ${admissionValue(form.residentialAddress)}`,
    `Occupation: ${admissionValue(form.guardianOccupation)}`,
    `Alternative contact: ${admissionValue(form.alternativeContact)}`,
    `Previous school: ${admissionValue(form.previousSchool)}`,
    `Last class completed: ${admissionValue(form.lastClassCompleted)}`,
    `Medical conditions/allergies: ${admissionValue(form.medicalConditions)}`,
    `Special needs/disabilities: ${admissionValue(form.specialNeeds)}`,
    `Known medical notes: ${admissionValue(form.knownMedicalNote)}`,
    `Emergency contact: ${admissionValue(form.emergencyContactName)} · ${admissionValue(form.emergencyContactPhone)} · ${admissionValue(form.emergencyContactRelationship)}`,
    `Admission date: ${admissionValue(form.admissionDate)}`,
    `Pupil type: ${admissionValue(form.enrollmentType)}`,
     `Funding status: ${form.isSponsored ? 'School-sponsored — no fees' : 'Fee-paying pupil'}`,
     `Previous terms balance: ${money(form.previousFeeBalance)}`,
     `Term fee: ${money(form.termFee)}`,
    `Amount paid: ${money(form.amountPaid)}`,
    `Fee balance: ${money(form.feeBalance)}`,
    `Declaration accepted: ${form.declarationAccepted ? 'Yes' : 'No'} · ${admissionValue(form.declarationDate)}`,
    'This is an official EMMECTY school admission record.',
  ], form.photoPath);
}

function admissionPrintContent(form: AdmissionForm) {
  const field = (label: string, value: unknown) => `<div><dt>${htmlEscape(label)}</dt><dd>${htmlEscape(label === 'Day or boarding' && form.isSponsored ? `${value} · School-sponsored — no fees` : value)}</dd></div>`;
  const photo = form.photoPath ? `<img class="photo-image" src="${htmlEscape(`/api/storage${form.photoPath}`)}" alt="Pupil passport photograph">` : '<span>PASSPORT<br>PHOTO<span>3 cm × 4 cm</span></span>';
  return `<style>.admission-identity{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin:0 0 22px;padding:14px 0 18px;border-bottom:1px solid #d9e2dc}.identity-label{margin:0;color:#1d7056;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}.identity-note{max-width:470px;margin:7px 0 0;color:#63756e;font-size:12px}.photo-box{width:3cm;height:4cm;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;border:1.5px solid #1d7056;background:#fffdf4;color:#1d7056;font-size:10px;font-weight:700;letter-spacing:.1em;text-align:center}.photo-box span{display:block;margin-top:8px;color:#63756e;font-size:8px;font-weight:400;letter-spacing:0}.photo-image{width:100%;height:100%;object-fit:cover}.section h2{position:relative;padding:0 0 10px;border-bottom:3px solid #1d7056;color:#1d7056}.section h2::after{content:"";position:absolute;left:0;right:0;bottom:3px;border-bottom:1px solid #e7b84b}.section dd{min-height:20px;padding:0 2px 5px;border-bottom:1px solid #1d7056}@media print{.admission-identity{break-inside:avoid}.section h2{break-after:avoid}}</style><div class="admission-identity"><div><p class="identity-label">Official pupil record</p><p class="identity-note">${form.photoPath ? 'Pupil passport photograph attached.' : 'Please attach a recent passport-size photograph in the holder provided.'}</p></div><div class="photo-box">${photo}</div></div><div class="section"><h2>Pupil information</h2><dl>${field('Pupil full name', form.pupilName)}${field('Registration number', form.registrationNumber)}${field('Date of birth', form.dateOfBirth)}${field('Gender', form.gender)}${field('Religion', form.religion)}${field('Place of birth', form.placeOfBirth)}${field('Home village', form.homeVillage)}${field('Nationality', form.nationality)}${field('Tribe', form.tribe)}${field('Class applying for', `${form.className}${form.stream ? ` · ${form.stream}` : ''}`)}${field('Day or boarding', form.enrollmentType)}</dl></div><div class="section"><h2>Parent or guardian information</h2><dl>${field('Name', form.guardianName)}${field('Relationship', form.guardianRelationship)}${field('Phone number', form.guardianPhone)}${field('Email address', form.guardianEmail)}${field('National ID number', form.guardianNationalId)}${field('Residential address', form.residentialAddress)}${field('Occupation', form.guardianOccupation)}${field('Alternative contact', form.alternativeContact)}</dl></div><div class="section"><h2>Previous school and health</h2><dl>${field('Previous school', form.previousSchool)}${field('Last class completed', form.lastClassCompleted)}${field('Medical conditions or allergies', form.medicalConditions)}${field('Special needs or disabilities', form.specialNeeds)}${field('Known medical notes', form.knownMedicalNote)}</dl></div><div class="section"><h2>Emergency contact</h2><dl>${field('Name', form.emergencyContactName)}${field('Phone number', form.emergencyContactPhone)}${field('Relationship', form.emergencyContactRelationship)}</dl></div><div class="section"><h2>Fees and declaration</h2><dl>${field('Admission date', form.admissionDate)}${field('Termly fee', money(form.termFee))}${field('Opening payment', money(form.amountPaid))}${field('Fee balance', money(form.feeBalance))}${field('Declaration accepted', form.declarationAccepted ? 'Yes' : 'No')}${field('Declaration date', form.declarationDate)}</dl><p class="declaration">I confirm that the information supplied on this admission form is correct.</p></div>`;
}

async function downloadAdmissionForm(form: AdmissionForm) {
  const url = URL.createObjectURL(await admissionFormPdf(form));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${form.registrationNumber}-admission-form.pdf`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function printAllAdmissionForms(students: Student[]) {
  const forms = await Promise.all(students.map((student) => getAdmissionForm(student.id)));
  const availableForms = forms.filter((form): form is AdmissionForm => Boolean(form));
  if (!availableForms.length) throw new Error('No admission forms are available.');
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
   const pages = availableForms.map((form) => `<section class="form">${schoolPrintHeader(`Official pupil admission form · ${form.registrationNumber}`)}${admissionPrintContent(form)}<p class="note">This is an official EMMECTY school admission record.</p></section>`).join('');
   printWindow.document.write(`<html><head><title>All pupil admission forms</title><style>body{font-family:Arial,sans-serif;color:#17231f;padding:36px;max-width:760px;margin:auto}.form{break-after:page;margin-bottom:48px}.form:last-child{break-after:auto}header{display:flex;gap:18px;border-bottom:3px solid #1d7056;padding-bottom:18px;margin-bottom:28px;min-height:92px}header img{width:84px;height:86px;object-fit:contain;order:2;margin-left:auto}h1{font-size:24px;margin:0 0 6px}p{color:#63756e;margin:4px 0}header strong{display:block;margin-top:10px}.section{border-top:1px solid #d9e2dc;padding-top:12px;margin-top:18px}.section h2{font-size:15px;margin:0 0 10px;color:#1d7056}dl{display:grid;grid-template-columns:1fr 1fr;gap:14px 28px}dt{font-size:10px;color:#63756e;text-transform:uppercase;letter-spacing:.12em}dd{font-size:14px;font-weight:600;margin:4px 0 0}.declaration{margin-top:18px}.note{margin-top:40px}@media print{body{padding:0}.form{margin-bottom:0}}</style></head><body>${pages}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function printAdmissionForm(form: AdmissionForm) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`<html><head><title>${htmlEscape(form.registrationNumber)} admission form</title><style>body{font-family:Arial,sans-serif;color:#17231f;padding:48px;max-width:720px;margin:auto}header{display:flex;gap:18px;border-bottom:3px solid #1d7056;padding-bottom:18px;margin-bottom:28px;min-height:92px}header img{width:84px;height:86px;object-fit:contain;order:2;margin-left:auto}h1{font-size:24px;margin:0 0 6px}p{color:#63756e;margin:4px 0}header strong{display:block;margin-top:10px}.section{border-top:1px solid #d9e2dc;padding-top:12px;margin-top:18px}.section h2{font-size:15px;margin:0 0 10px;color:#1d7056}dl{display:grid;grid-template-columns:1fr 1fr;gap:14px 28px}dt{font-size:10px;color:#63756e;text-transform:uppercase;letter-spacing:.12em}dd{font-size:14px;font-weight:600;margin:4px 0 0}.declaration{margin-top:18px}@media print{body{padding:0}}</style></head><body>${schoolPrintHeader(`Official pupil admission form · ${form.registrationNumber}`)}${admissionPrintContent(form)}<p style="margin-top:40px">This is an official EMMECTY school admission record.</p></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export function TransactionsPage() {
  const { data: session } = useGetCurrentUser();
  const query = useListPayments();
  const [location] = useLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filter = new URLSearchParams(location.split('?')[1] || '').get('filter');
  const transactions = (query.data || []).filter((item) => filter !== 'collected' || item.status === 'completed');
  const selected = transactions.find((item) => item.id === selectedId);
  const isAdmin = session?.user.role === 'administrator' || session?.user.role === 'super_admin';
  const canAct = isAdmin || session?.user.permissions.includes('transactions_print');
  const printReceipt = (item: typeof transactions[number]) => {
    receiptPrintPage(item, transactions.filter((payment) => payment.studentId === item.studentId));
  };
  const downloadReceipt = async (item: typeof transactions[number]) => {
    const url = URL.createObjectURL(await receiptPdf(item, transactions.filter((payment) => payment.studentId === item.studentId)));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${item.receiptNumber}.pdf`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const shareReceipt = async (item: typeof transactions[number]) => {
    const file = new File([await receiptPdf(item, transactions.filter((payment) => payment.studentId === item.studentId))], `${item.receiptNumber}.pdf`, { type: 'application/pdf' });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) await navigator.share({ title: item.receiptNumber, files: [file] });
    else if (navigator.clipboard) await navigator.clipboard.writeText(`Receipt ${item.receiptNumber}: ${item.studentName}, ${money(item.amount)}, ${item.date}. Download the PDF to share it.`);
  };
  return <AppShell><PageHeader eyebrow="Finance · Transactions" title={filter === 'collected' ? 'Collected payments' : 'Payment transactions'} description={filter === 'collected' ? 'Every completed payment behind the collected figure, including the pupil and receipt.' : 'Find old payment receipts and print, download, or share them when a guardian needs a copy.'} action={<Button variant="secondary" onClick={() => query.refetch()} testId="button-refresh-transactions"><RefreshCcw className="size-4" /> Refresh</Button>} />{query.isError ? <Panel><ErrorState onRetry={() => query.refetch()} /></Panel> : <Panel className="overflow-hidden" testId="panel-transactions"><div className="border-b border-[hsl(var(--border))] p-5"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Receipt archive</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{transactions.length} transaction{transactions.length === 1 ? '' : 's'} recorded</p></div>{transactions.length ? <div className="divide-y divide-[hsl(var(--border))]">{transactions.map((item) => <div key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" data-testid={`row-transaction-${item.id}`}><div className="min-w-0"><Link href={`/transactions/${item.id}`} className="font-mono-ui text-xs font-semibold text-[hsl(var(--primary))] hover:underline">{item.receiptNumber}</Link><p className="mt-1 text-sm font-semibold">{item.studentName}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{item.registrationNumber} · {item.date} · {item.method}</p></div><div className="flex flex-wrap items-center gap-3"><span className="font-display text-lg">{money(item.amount)}</span>{canAct && <><button onClick={() => printReceipt(item)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--primary))] hover:underline" data-testid={`button-print-receipt-${item.id}`}><Printer className="size-3.5" /> Print</button><button onClick={() => downloadReceipt(item)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--primary))] hover:underline" data-testid={`button-download-receipt-${item.id}`}><Download className="size-3.5" /> Download</button><button onClick={() => void shareReceipt(item)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--primary))] hover:underline" data-testid={`button-share-receipt-${item.id}`}><Share2 className="size-3.5" /> Share</button></>}</div></div>)}</div> : <EmptyState icon={Receipt} title="No payment transactions yet" description="Completed pupil payments will appear here with their receipt numbers." />}</Panel>}<div className="hidden print:block">{selected && <article className="mt-8 border-t border-[hsl(var(--border))] pt-6"><p className="font-mono-ui text-xs uppercase tracking-[.16em] text-[hsl(var(--primary))]">Payment receipt</p><h2 className="mt-2 font-display text-3xl">{selected.receiptNumber}</h2><dl className="mt-6 grid max-w-xl grid-cols-2 gap-x-8 gap-y-4 text-sm"><div><dt className="text-[hsl(var(--muted-foreground))]">Pupil</dt><dd className="font-semibold">{selected.studentName}</dd></div><div><dt className="text-[hsl(var(--muted-foreground))]">Registration number</dt><dd className="font-semibold">{selected.registrationNumber}</dd></div><div><dt className="text-[hsl(var(--muted-foreground))]">Amount</dt><dd className="font-semibold">{money(selected.amount)}</dd></div><div><dt className="text-[hsl(var(--muted-foreground))]">Payment method</dt><dd className="font-semibold">{selected.method}</dd></div><div><dt className="text-[hsl(var(--muted-foreground))]">Date</dt><dd className="font-semibold">{selected.date}</dd></div><div><dt className="text-[hsl(var(--muted-foreground))]">Status</dt><dd className="font-semibold">{selected.status}</dd></div></dl><p className="mt-12 text-xs text-[hsl(var(--muted-foreground))]">This is an official EMMECTY school payment record.</p></article>}</div></AppShell>;
}

function LegacyTransactionDetailPage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const { data: session } = useGetCurrentUser();
  const query = useListPayments();
  const item = query.data?.find((payment) => payment.id === transactionId);
  const history = item ? (query.data || []).filter((payment) => payment.studentId === item.studentId) : [];
  const canAct = session?.user.role === 'administrator' || session?.user.role === 'super_admin' || session?.user.permissions.includes('transactions_print');
  const download = async () => {
    if (!item) return;
     const url = URL.createObjectURL(await receiptPdf(item, history));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${item.receiptNumber}.pdf`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const share = async () => {
    if (!item) return;
      const file = new File([await receiptPdf(item, history)], `${item.receiptNumber}.pdf`, { type: 'application/pdf' });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) await navigator.share({ title: item.receiptNumber, files: [file] });
    else if (navigator.clipboard) await navigator.clipboard.writeText(`Receipt ${item.receiptNumber}: ${item.studentName}, ${money(item.amount)}, ${item.date}. Download the PDF to share it.`);
  };
   return <AppShell>{query.isLoading ? <Panel><Skeleton className="h-40" /></Panel> : !item ? <Panel><ErrorState message="That transaction could not be found." onRetry={() => query.refetch()} /></Panel> : <div className="mx-auto max-w-3xl"><Link href="/transactions" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--primary))] hover:underline"><ArrowLeft className="size-4" /> Back to transactions</Link><Panel className="p-6 sm:p-10" testId="panel-transaction-detail"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[hsl(var(--border))] pb-6"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Official payment receipt</p><h1 className="mt-2 font-display text-3xl">{item.receiptNumber}</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">EMMECTY NURSERY & PRIMARY SCHOOL</p></div><span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs font-semibold capitalize text-[hsl(var(--primary))]">{item.status}</span></div><dl className="mt-8 grid gap-6 sm:grid-cols-2">{[['Pupil', item.studentName], ['Registration number', item.registrationNumber], ['Amount', money(item.amount)], ['Current balance', money(item.balance)], ['Payment method', item.method], ['Date', item.date], ['Status', item.status]].map(([label, value]) => <div key={label}><dt className="text-[10px] font-semibold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{label}</dt><dd className={`mt-1 text-sm font-semibold ${label === 'Amount' ? 'font-display text-2xl text-[hsl(var(--primary))]' : ''}`}>{value}</dd></div>)}</dl><div className="mt-10 border-t border-[hsl(var(--border))] pt-6"><h2 className="font-display text-xl">Payment history</h2><div className="mt-3 divide-y divide-[hsl(var(--border))]">{history.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span><span className="block font-mono-ui text-xs font-semibold text-[hsl(var(--primary))]">{payment.receiptNumber}</span><span className="text-xs text-[hsl(var(--muted-foreground))]">{payment.date}</span></span><span className="font-semibold">{money(payment.amount)}</span></div>)}</div></div>{canAct && <div className="mt-10 flex flex-wrap gap-3 border-t border-[hsl(var(--border))] pt-6"><Button onClick={() => receiptPrintPage(item, history)} testId="button-print-transaction"><Printer className="size-4" /> Print</Button><Button variant="secondary" onClick={download} testId="button-download-transaction"><Download className="size-4" /> Download PDF</Button><Button variant="secondary" onClick={() => void share()} testId="button-share-transaction"><Share2 className="size-4" /> Share PDF</Button></div>}</Panel></div>}</AppShell>;
}

export function SalaryReceiptPage() {
  const { salaryId } = useParams<{ salaryId: string }>();
  const query = useListSalaries();
  const item = query.data?.find((payment) => payment.id === salaryId);
  const history = item ? (query.data || []).filter((payment) => payment.staffId === item.staffId) : [];
  const print = () => {
    if (!item) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>${item.receiptNumber}</title><style>body{font-family:Arial,sans-serif;color:#17231f;padding:48px;max-width:720px;margin:auto}header{border-bottom:3px solid #1d7056;padding-bottom:18px;margin-bottom:28px}h1{font-size:24px;margin:0 0 6px}p{color:#63756e}dl{display:grid;grid-template-columns:1fr 1fr;gap:18px 32px}dt{font-size:11px;color:#63756e;text-transform:uppercase;letter-spacing:.12em}dd{font-size:16px;font-weight:600;margin:5px 0 0}.amount{font-size:28px;color:#1d7056}table{width:100%;margin-top:32px;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:8px;border-bottom:1px solid #d9e2dc}@media print{body{padding:0}}</style></head><body><header><h1>EMMECTY NURSERY & PRIMARY SCHOOL</h1><p>Salary payment receipt · ${item.receiptNumber}</p></header><dl><div><dt>Staff member</dt><dd>${item.staffName}</dd></div><div><dt>Period</dt><dd>${item.period}</dd></div><div><dt>Monthly salary</dt><dd>${money(item.monthlySalary)}</dd></div><div><dt>Amount paid</dt><dd class="amount">${money(item.amount)}</dd></div><div><dt>Balance</dt><dd>${money(item.balance)}</dd></div><div><dt>Payment date</dt><dd>${item.paymentDate}</dd></div><div><dt>Method</dt><dd>${item.method}</dd></div><div><dt>Reference</dt><dd>${item.reference || '—'}</dd></div></dl><h2>Payment history</h2><table><thead><tr><th>Date</th><th>Period</th><th>Receipt number</th><th>Amount</th></tr></thead><tbody>${history.map((payment) => `<tr><td>${payment.paymentDate}</td><td>${payment.period}</td><td>${payment.receiptNumber}</td><td>${money(payment.amount)}</td></tr>`).join('')}</tbody></table></body></html>`);
     addPrintLogo(printWindow);
     printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };
  return <AppShell>{query.isLoading ? <Panel><Skeleton className="h-40" /></Panel> : !item ? <Panel><ErrorState message="That salary receipt could not be found." onRetry={() => query.refetch()} /></Panel> : <div className="mx-auto max-w-3xl"><Link href="/operations?view=salaries" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--primary))] hover:underline"><ArrowLeft className="size-4" /> Back to salaries</Link><Panel className="p-6 sm:p-10" testId="panel-salary-receipt"><div className="border-b border-[hsl(var(--border))] pb-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Official salary receipt</p><h1 className="mt-2 font-display text-3xl">{item.receiptNumber}</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">EMMECTY NURSERY & PRIMARY SCHOOL</p></div><dl className="mt-8 grid gap-6 sm:grid-cols-2">{[['Staff member', item.staffName], ['Period', item.period], ['Monthly salary', money(item.monthlySalary)], ['Amount paid', money(item.amount)], ['Balance', money(item.balance)], ['Payment date', item.paymentDate], ['Method', item.method], ['Reference', item.reference || '—']].map(([label, value]) => <div key={label}><dt className="text-[10px] font-semibold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{label}</dt><dd className={`mt-1 text-sm font-semibold ${label === 'Amount paid' ? 'font-display text-2xl text-[hsl(var(--primary))]' : ''}`}>{value}</dd></div>)}</dl><div className="mt-10 border-t border-[hsl(var(--border))] pt-6"><h2 className="font-display text-xl">Payment history</h2><div className="mt-3 divide-y divide-[hsl(var(--border))]">{history.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span><span className="block font-mono-ui text-xs font-semibold text-[hsl(var(--primary))]">{payment.receiptNumber}</span><span className="text-xs text-[hsl(var(--muted-foreground))]">{payment.paymentDate} · {payment.period}</span></span><span className="font-semibold">{money(payment.amount)}</span></div>)}</div></div><Button className="mt-8" onClick={print} testId="button-print-salary-receipt"><Printer className="size-4" /> Print receipt</Button></Panel></div>}</AppShell>;
}

type DashboardMetric = { label: string; value: string | number; Icon: LucideIcon; color: string; href?: string; detail?: string };

function DashboardMetricCard({ metric, index }: { metric: DashboardMetric; index: number }) {
  const content = <Panel className={`animate-rise-in delay-${index + 1} p-5 transition-colors ${metric.href ? 'hover:border-[hsl(var(--primary)/.45)] hover:bg-[hsl(var(--secondary)/.35)]' : ''}`} testId={`card-role-metric-${metric.label.toLowerCase().replaceAll(' ', '-')}`}><div className="flex items-start justify-between gap-3"><span className="text-sm text-[hsl(var(--muted-foreground))]">{metric.label}</span><span className={`flex size-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--muted))] ${metric.color}`}><metric.Icon className="size-[18px]" /></span></div><p className="mt-5 font-display text-3xl tracking-tight" data-testid={`text-role-metric-${index}`}>{metric.value}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{metric.detail || (metric.href ? 'Click to view the records' : 'From your current school data')}</p>{metric.href && <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[hsl(var(--primary))]">Open details <ArrowRight className="size-3" /></span>}</Panel>;
  return metric.href ? <Link href={metric.href} className="block" data-testid={`link-role-metric-${index}`}>{content}</Link> : content;
}

function DashboardCharts({ dashboard, payments, expenses, isFinance }: { dashboard?: Dashboard; payments: Array<{ date: string; amount: number }>; expenses: Array<{ category?: unknown; amount?: unknown }>; isFinance: boolean }) {
  const paymentSeries = useMemo(() => {
    const grouped = new Map<string, number>();
    payments.forEach((payment) => grouped.set(payment.date, (grouped.get(payment.date) || 0) + payment.amount));
    return Array.from(grouped, ([date, amount]) => ({ date, amount })).slice(-7);
  }, [payments]);
  const expenseSeries = useMemo(() => {
    const grouped = new Map<string, number>();
    expenses.forEach((expense) => {
      const category = String(expense.category || 'Other');
      grouped.set(category, (grouped.get(category) || 0) + Number(expense.amount || 0));
    });
    return Array.from(grouped, ([category, amount]) => ({ category, amount })).slice(0, 6);
  }, [expenses]);
  const attendance = dashboard?.attendanceTrend || [];
  return <div className="space-y-6">
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel className="overflow-hidden" testId="panel-dashboard-attendance-chart"><div className="flex items-start justify-between border-b border-[hsl(var(--border))] p-5"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Attendance trend</p><h2 className="mt-1 font-display text-2xl">Presence across recent registers</h2></div><Link href="/attendance" className="text-xs font-semibold text-[hsl(var(--primary))]">Open register <ArrowRight className="ml-1 inline size-3" /></Link></div>{attendance.length ? <div className="h-64 p-4 sm:p-6"><ResponsiveContainer width="100%" height="100%"><BarChart data={attendance} barGap={6}><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={(value) => `${value}%`} /><Tooltip formatter={(value) => `${value}%`} /><Bar dataKey="present" name="Present" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} /><Bar dataKey="absent" name="Absent" fill="hsl(var(--destructive))" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState icon={CalendarDays} title="No attendance trend yet" description="Create a register to start seeing attendance patterns." />}</Panel>
      {isFinance ? <Panel className="overflow-hidden" testId="panel-dashboard-collections-chart"><div className="flex items-start justify-between border-b border-[hsl(var(--border))] p-5"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Collections</p><h2 className="mt-1 font-display text-2xl">Payment activity</h2></div><Link href="/transactions?filter=collected" className="text-xs font-semibold text-[hsl(var(--primary))]">View paying pupils <ArrowRight className="ml-1 inline size-3" /></Link></div>{paymentSeries.length ? <div className="h-64 p-4 sm:p-6"><ResponsiveContainer width="100%" height="100%"><AreaChart data={paymentSeries}><defs><linearGradient id="dashboardCollectionFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={(value) => `${Number(value).toLocaleString()}`} /><Tooltip formatter={(value) => money(Number(value))} /><Area type="monotone" dataKey="amount" name="Collected" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#dashboardCollectionFill)" /></AreaChart></ResponsiveContainer></div> : <EmptyState icon={CircleDollarSign} title="No payment activity yet" description="Completed payments will appear here with a link to every receipt." />}</Panel> : <Panel className="overflow-hidden" testId="panel-dashboard-focus"><div className="border-b border-[hsl(var(--border))] p-5"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">School pulse</p><h2 className="mt-1 font-display text-2xl">Keep the day moving</h2></div><div className="p-6"><p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">Use the action cards above to open the real registers, pupil records, assignments, and school operations available to your role.</p><Link href="/operations?view=events" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))]">Open operations hub <ArrowRight className="size-3" /></Link></div></Panel>}
    </div>
    {isFinance && <Panel className="overflow-hidden" testId="panel-dashboard-expense-chart"><div className="flex items-start justify-between border-b border-[hsl(var(--border))] p-5"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Spending</p><h2 className="mt-1 font-display text-2xl">Expenses by category</h2></div><Link href="/expenses" className="text-xs font-semibold text-[hsl(var(--primary))]">Review expenses <ArrowRight className="ml-1 inline size-3" /></Link></div>{expenseSeries.length ? <div className="h-64 p-4 sm:p-6"><ResponsiveContainer width="100%" height="100%"><BarChart data={expenseSeries} layout="vertical" margin={{ left: 10, right: 20 }}><CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" /><XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={(value) => `${Number(value).toLocaleString()}`} /><YAxis type="category" dataKey="category" width={90} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><Tooltip formatter={(value) => money(Number(value))} /><Bar dataKey="amount" name="Expenses" fill="hsl(var(--chart-4))" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState icon={Receipt} title="No expenses recorded yet" description="Recorded expenses will be grouped here for quick review." />}</Panel>}
  </div>;
}

function DashboardPage() {
  const { data: session } = useGetCurrentUser();
  const query = useGetDashboard();
  const operations = useGetOperations();
  const dashboard = query.data as Dashboard | undefined;
  const role = session?.user.role || dashboard?.role || 'administrator';
  const summary = dashboard?.summary;
  const modules = operations.data?.modules;
  const resolvedRole = session?.user.role || dashboard?.role;
  const isFinance = resolvedRole === 'administrator' || resolvedRole === 'super_admin' || resolvedRole === 'accountant';
  const paymentQuery = useListPayments({ query: { queryKey: getListPaymentsQueryKey(), enabled: isFinance } });
  const metrics: DashboardMetric[] = role === 'teacher'
    ? [
      { label: 'My classes', value: dashboard?.assignedClasses?.length ?? modules?.classes.length ?? 0, Icon: Users, color: 'text-[hsl(var(--primary))]', href: '/operations?view=classes' },
      { label: 'Learners I support', value: modules?.classes.reduce((sum, item) => sum + item.pupilCount, 0) ?? 0, Icon: GraduationCap, color: 'text-[hsl(var(--chart-3))]', href: '/students' },
      { label: 'Attendance today', value: `${summary?.attendance ?? 0}%`, Icon: CalendarDays, color: 'text-[hsl(var(--chart-2))]', href: '/attendance' },
      { label: 'Assignments due', value: modules?.assignments.filter((item) => item.status !== 'completed').length ?? 0, Icon: ClipboardList, color: 'text-[hsl(var(--chart-4))]', href: '/operations?view=assignments' },
    ]
    : role === 'accountant'
      ? [
        { label: 'Collected this term', value: money(summary?.feesCollected), Icon: CircleDollarSign, color: 'text-[hsl(var(--primary))]', href: '/transactions?filter=collected', detail: 'Click to see the pupils and receipts' },
        { label: 'Outstanding balance', value: money(summary?.outstandingFees), Icon: WalletCards, color: 'text-[hsl(var(--chart-4))]', href: '/students?filter=outstanding', detail: 'Click to list pupils who still owe' },
        { label: 'Collection rate', value: `${summary?.feesCollected && summary.outstandingFees ? Math.round((summary.feesCollected / (summary.feesCollected + summary.outstandingFees)) * 100) : 0}%`, Icon: BarChart3, color: 'text-[hsl(var(--chart-2))]', href: '/finance' },
        { label: 'Expenses logged', value: modules?.expenses.length ?? 0, Icon: Receipt, color: 'text-[hsl(var(--chart-3))]', href: '/expenses' },
      ]
      : role === 'guardian' || role === 'student'
        ? [
          { label: 'Attendance', value: `${summary?.attendance ?? 0}%`, Icon: CalendarDays, color: 'text-[hsl(var(--chart-3))]', href: '/attendance' },
          { label: 'Open assignments', value: modules?.assignments.filter((item) => item.status !== 'completed').length ?? 0, Icon: ClipboardList, color: 'text-[hsl(var(--chart-2))]', href: '/operations?view=assignments' },
          { label: 'Latest result', value: dashboard?.latestResult !== undefined ? `${dashboard.latestResult}%` : '—', Icon: BadgeCheck, color: 'text-[hsl(var(--primary))]', href: '/students' },
          { label: 'Fee balance', value: money(dashboard?.feeBalance ?? 0), Icon: WalletCards, color: 'text-[hsl(var(--chart-4))]', href: '/students' },
        ]
        : role === 'staff'
          ? [
            { label: 'Upcoming events', value: modules?.events.length ?? dashboard?.upcomingEvents.length ?? 0, Icon: CalendarDays, color: 'text-[hsl(var(--chart-3))]', href: '/operations?view=events' },
            { label: 'Shared documents', value: modules?.documents.length ?? 0, Icon: FileText, color: 'text-[hsl(var(--chart-2))]', href: '/operations?view=documents' },
            { label: 'Notifications', value: modules?.notifications.filter((item) => !item.read).length ?? 0, Icon: Megaphone, color: 'text-[hsl(var(--chart-4))]', href: '/operations?view=notifications' },
            { label: 'Timetable sessions', value: dashboard?.summary.classes ?? 0, Icon: BookOpen, color: 'text-[hsl(var(--primary))]', href: '/timetable' },
          ]
          : [
            { label: 'Learners', value: summary?.students ?? 0, Icon: Users, color: 'text-[hsl(var(--primary))]', href: '/students' },
            { label: 'Classes', value: summary?.classes ?? modules?.classes.length ?? 0, Icon: GraduationCap, color: 'text-[hsl(var(--chart-3))]', href: '/operations?view=classes' },
            { label: 'Attendance today', value: `${summary?.attendance ?? 0}%`, Icon: CalendarDays, color: 'text-[hsl(var(--chart-2))]', href: '/attendance' },
            { label: 'Fees collected', value: money(summary?.feesCollected), Icon: CircleDollarSign, color: 'text-[hsl(var(--primary))]', href: '/transactions?filter=collected', detail: 'Click to see the pupils and receipts' },
          ];
  const actionCards = dashboard?.roleActions || [];
  return <AppShell>
    <PageHeader eyebrow={`${todayLabel} · ${role.replace('_', ' ')}`} title={dashboard?.greeting || 'Your school day'} description={role === 'teacher' ? 'Your assigned classes, registers, and learning work in one calm view.' : role === 'accountant' ? 'A clear view of collections, spending, and the numbers that need follow-up.' : role === 'guardian' || role === 'student' ? 'Only the linked learner information relevant to your day.' : 'The right school information, arranged for the work in front of you.'} action={<Button testId="button-dashboard-refresh" variant="secondary" onClick={() => { void query.refetch(); void operations.refetch(); }}><RefreshCcw className="size-4" /> Refresh</Button>} />
    {query.isError ? <Panel><ErrorState onRetry={() => query.refetch()} /></Panel> : query.isLoading ? <DashboardSkeleton /> : <div className="space-y-6">
       <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric, index) => <DashboardMetricCard key={metric.label} metric={metric} index={index} />)}</div>
       <DashboardCharts dashboard={dashboard} payments={paymentQuery.data || []} expenses={modules?.expenses || []} isFinance={isFinance} />
      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <Panel className="overflow-hidden" testId="panel-role-actions"><div className="border-b border-[hsl(var(--border))] p-5 md:p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Workday shortcuts</p><h2 className="mt-1 font-display text-2xl">What needs your attention</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">These actions come from your role permissions.</p></div>{actionCards.length ? <div className="divide-y divide-[hsl(var(--border))]">{actionCards.map((action) => <Link href={action.href} key={action.id} data-testid={`link-role-action-${action.id}`} className="group flex items-start gap-4 p-5 transition-colors hover:bg-[hsl(var(--muted)/.45)]"><span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{action.label}</span><span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">{action.description}</span></span><ArrowRight className="mt-2 size-4 text-[hsl(var(--muted-foreground))]" /></Link>)}</div> : <EmptyState icon={ClipboardList} title="No actions assigned" description="Your school has not added any role-specific actions yet." />}</Panel>
        <Panel testId="panel-role-focus"><div className="border-b border-[hsl(var(--border))] p-5"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Keep moving</p><h2 className="mt-1 font-display text-2xl">{role === 'teacher' ? 'Your teaching focus' : role === 'accountant' ? 'Finance focus' : role === 'guardian' || role === 'student' ? 'Learner focus' : 'School pulse'}</h2></div><div className="p-5">{role === 'teacher' && modules?.classes.length ? <div className="space-y-3">{modules.classes.map((item) => <Link href="/operations?view=classes" key={item.id} className="flex items-center justify-between rounded-xl bg-[hsl(var(--muted)/.62)] p-4 hover:bg-[hsl(var(--secondary))]" data-testid={`link-dashboard-class-${item.id}`}><span><span className="block text-sm font-semibold">{item.name}</span><span className="text-xs text-[hsl(var(--muted-foreground))]">{item.pupilCount} learners · {item.subjectCount} subjects</span></span><ArrowRight className="size-4 text-[hsl(var(--primary))]" /></Link>)}</div> : role === 'guardian' || role === 'student' ? <div className="rounded-2xl bg-[hsl(var(--secondary)/.65)] p-5"><p className="text-sm font-semibold">{dashboard?.children?.[0]?.name || 'Your linked learner'}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{dashboard?.children?.[0] ? `${dashboard.children[0].className} · Stream ${dashboard.children[0].stream}` : 'Linked learner details are available in your profile.'}</p><Link href="/operations?view=assignments" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))]" data-testid="link-dashboard-learner-work">Open learner work <ArrowRight className="size-3" /></Link></div> : <div className="space-y-3"><p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">Use Operations to move between the school records available to your role.</p><Link href="/operations?view=events" className="inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))]" data-testid="link-dashboard-operations">Open operations hub <ArrowRight className="size-3" /></Link></div>}</div></Panel>
      </div>
      <Panel className="overflow-hidden" testId="panel-dashboard-upcoming"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-5"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">On the horizon</p><h2 className="mt-1 font-display text-2xl">Upcoming</h2></div><Link href="/operations?view=events" className="text-xs font-semibold text-[hsl(var(--primary))]" data-testid="link-dashboard-events">View events <ArrowRight className="ml-1 inline size-3" /></Link></div>{dashboard?.upcomingEvents?.length ? <div className="grid gap-px bg-[hsl(var(--border))] sm:grid-cols-3">{dashboard.upcomingEvents.slice(0, 3).map((event, index) => <div className="bg-[hsl(var(--card))] p-5" key={`${event.title}-${index}`} data-testid={`dashboard-event-${index}`}><span className="font-mono-ui text-[10px] text-[hsl(var(--primary))]">{event.date}</span><p className="mt-3 text-sm font-semibold">{event.title}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{event.type}</p></div>)}</div> : <EmptyState icon={CalendarDays} title="A clear calendar" description="There are no upcoming events to show." />}</Panel>
    </div>}
  </AppShell>;
}

function DashboardSkeleton() { return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <Panel className="p-5" key={item}><Skeleton className="h-4 w-28" /><Skeleton className="mt-6 h-9 w-24" /><Skeleton className="mt-2 h-3 w-32" /></Panel>)}</div><div className="grid gap-6 xl:grid-cols-2"><Panel className="p-6"><Skeleton className="h-7 w-48" /><Skeleton className="mt-8 h-52 w-full" /></Panel><Panel className="p-6"><Skeleton className="h-7 w-36" /><Skeleton className="mt-8 h-32 w-full" /></Panel></div></div>; }

function ProfileSkeleton() {
  return <div className="space-y-6"><Panel className="overflow-hidden p-6"><Skeleton className="h-24 w-full" /><div className="mt-5 flex gap-4"><Skeleton className="size-16 rounded-2xl" /><div><Skeleton className="h-7 w-48" /><Skeleton className="mt-2 h-3 w-32" /></div></div></Panel><div className="grid gap-6 lg:grid-cols-2"><Panel className="p-6"><Skeleton className="h-5 w-32" /><Skeleton className="mt-6 h-24 w-full" /></Panel><Panel className="p-6"><Skeleton className="h-5 w-32" /><Skeleton className="mt-6 h-24 w-full" /></Panel></div></div>;
}

function StudentsPage() {
  const client = useQueryClient();
  const { data: session } = useGetCurrentUser();
  const [location] = useLocation();
  const outstandingOnly = new URLSearchParams(location.split('?')[1] || '').get('filter') === 'outstanding';
  const canRegister = session?.user.role === 'administrator' || session?.user.role === 'super_admin';
  const [search, setSearch] = useState('');
  const [className, setClassName] = useState('All classes');
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [generatingAdmissionForms, setGeneratingAdmissionForms] = useState(false);
  const [admissionFormsError, setAdmissionFormsError] = useState('');
   const [registrationConfirmation, setRegistrationConfirmation] = useState<{ registrationNumber: string; pupilName: string; className: string; stream: string; guardianName: string; guardianPhone: string; isSponsored: boolean; receiptNumber?: string; amount?: number; method?: string; admissionForm?: AdmissionForm } | null>(null);
   const emptyForm = {
     firstName: '', middleName: '', lastName: '', dateOfBirth: '', gender: 'Female', className: 'Primary 1', stream: 'A',
       guardianName: '', guardianPhone: '', guardianEmail: '', enrollmentType: 'day', isSponsored: false, termFee: '', previousFeeBalance: '', initialPayment: '', paymentMethod: 'Cash', paymentReference: '',
     religion: '', placeOfBirth: '', homeVillage: '', nationality: '', tribe: '', guardianRelationship: '', guardianNationalId: '',
     residentialAddress: '', guardianOccupation: '', alternativeContact: '', previousSchool: '', lastClassCompleted: '',
     medicalConditions: '', specialNeeds: '', knownMedicalNote: '', emergencyContactName: '', emergencyContactPhone: '',
     emergencyContactRelationship: '', declarationAccepted: false, declarationDate: new Date().toISOString().slice(0, 10),
   };
  const [form, setForm] = useState(emptyForm);
   const params = useMemo(() => ({ search: search || undefined, className: className === 'All classes' ? undefined : className, status: status ? status as 'active' | 'inactive' : undefined }), [search, className, status]);
  const query = useListStudents(params);
  const create = useCreateStudent();
   const update = (key: string, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const openingPayment = form.initialPayment ? Number(form.initialPayment) : undefined;
    const data: StudentInput = { ...form, enrollmentType: form.enrollmentType as 'day' | 'boarding', termFee: Number(form.termFee || 0), previousFeeBalance: Number(form.previousFeeBalance || 0), initialPayment: openingPayment };
    create.mutate({ data }, {
      onSuccess: (pupil) => {
        trackEvent('pupil_registered', { enrollment_type: data.enrollmentType ?? 'day', opening_payment: (data.initialPayment ?? 0) > 0 });
        client.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        client.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
        setShowForm(false);
         setRegistrationConfirmation({
           registrationNumber: pupil.registrationNumber,
           pupilName: pupil.name,
           className: pupil.className,
           stream: pupil.stream,
            guardianName: form.guardianName,
           guardianPhone: form.guardianPhone,
            isSponsored: pupil.isSponsored,
           ...(pupil.receiptNumber && openingPayment ? { receiptNumber: pupil.receiptNumber, amount: openingPayment, method: form.paymentMethod } : {}),
           ...(pupil.admissionForm ? { admissionForm: pupil.admissionForm } : {}),
         });
        setForm(emptyForm);
      },
    });
  };
  const students = (query.data || []).filter((student) => !outstandingOnly || student.feeBalance > 0);
  const generateAllAdmissionForms = async () => {
    const allStudents = query.data || [];
    if (!allStudents.length) return;
    setAdmissionFormsError('');
    setGeneratingAdmissionForms(true);
    try {
      await printAllAdmissionForms(allStudents);
    } catch {
      setAdmissionFormsError('Admission forms could not be generated. Please try again.');
    } finally {
      setGeneratingAdmissionForms(false);
    }
  };
   if (registrationConfirmation) {
     return <AppShell><PageHeader eyebrow="Pupil registered" title="Admission form ready" description="The pupil was saved, the permanent registration number was generated, and the admission form was saved automatically." /><Panel className="mx-auto max-w-2xl overflow-hidden" testId="panel-registration-confirmation"><div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.55)] p-6"><SchoolMark /><h2 className="mt-5 font-display text-2xl">{SCHOOL_NAME}</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Official pupil admission form</p></div><dl className="grid gap-4 p-6 sm:grid-cols-2"><div className="sm:col-span-2 rounded-2xl bg-[hsl(var(--primary)/.08)] p-4"><dt className="text-xs text-[hsl(var(--muted-foreground))]">Permanent registration number</dt><dd className="mt-1 font-mono-ui text-xl font-semibold text-[hsl(var(--primary))]" data-testid="text-registration-number">{registrationConfirmation.registrationNumber}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Pupil</dt><dd className="mt-1 text-sm font-semibold">{registrationConfirmation.pupilName}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Class</dt><dd className="mt-1 text-sm font-semibold">{registrationConfirmation.className}{registrationConfirmation.stream ? ` · ${registrationConfirmation.stream}` : ''}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Guardian</dt><dd className="mt-1 text-sm font-semibold">{registrationConfirmation.guardianName}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Guardian contact</dt><dd className="mt-1 text-sm font-semibold">{registrationConfirmation.guardianPhone}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Funding</dt><dd className="mt-1 text-sm font-semibold">{registrationConfirmation.isSponsored ? 'School-sponsored · no fees' : 'Fee-paying pupil'}</dd></div>{registrationConfirmation.receiptNumber && <><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Opening receipt</dt><dd className="mt-1 font-mono-ui text-sm font-semibold">{registrationConfirmation.receiptNumber}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Opening payment</dt><dd className="mt-1 text-sm font-semibold">{money(registrationConfirmation.amount)} · {registrationConfirmation.method}</dd></div></>}</dl><div className="flex flex-wrap justify-end gap-3 border-t border-[hsl(var(--border))] p-5">{registrationConfirmation.admissionForm ? <><Button variant="secondary" onClick={() => downloadAdmissionForm(registrationConfirmation.admissionForm!)} testId="button-download-admission-form"><Download className="size-4" /> Download PDF</Button><Button variant="secondary" onClick={() => printAdmissionForm(registrationConfirmation.admissionForm!)} testId="button-print-admission-form"><Printer className="size-4" /> Print admission form</Button></> : <Button variant="secondary" onClick={() => window.print()} testId="button-print-registration-form"><Printer className="size-4" /> Print registration form</Button>}<Button onClick={() => setRegistrationConfirmation(null)} testId="button-finish-registration">Return to pupils</Button></div></Panel></AppShell>;
  }
   return <AppShell><PageHeader eyebrow="Directory" title={outstandingOnly ? "Pupils with outstanding balances" : "Students"} description={outstandingOnly ? "Every active pupil with a fee balance, linked directly from the dashboard total." : "A clear record of every learner, from first admission to final report card."} action={canRegister ? <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => void generateAllAdmissionForms()} disabled={generatingAdmissionForms || !query.data?.length} testId="button-generate-all-admission-forms"><Printer className="size-4" /> {generatingAdmissionForms ? 'Preparing forms…' : 'Generate all admission forms'}</Button><Button onClick={() => setShowForm(true)} testId="button-open-register"><Plus className="size-4" /> Register student</Button></div> : undefined} />{admissionFormsError && <p className="mb-5 text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="status-admission-forms-error">{admissionFormsError}</p>}<Panel className="mb-6 p-4" testId="panel-student-filters"><div className="flex flex-col gap-3 lg:flex-row"><label className="relative flex-1"><Search className="absolute left-3.5 top-3.5 size-4 text-[hsl(var(--muted-foreground))]" /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or registration number" className="focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] pl-10 pr-4 text-sm outline-none" data-testid="input-student-search" /></label><div className="flex gap-3"><SelectField label="" value={className} onChange={setClassName} options={['All classes', ...pupilClassOptions]} /><SelectField label="" value={status || 'All statuses'} onChange={(value) => setStatus(value === 'All statuses' ? '' : value)} options={['All statuses', 'active', 'inactive']} /></div></div></Panel><Panel className="overflow-hidden" testId="panel-students-table">{query.isError ? <ErrorState onRetry={() => query.refetch()} /> : query.isLoading ? <div className="space-y-4 p-6">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div> : students.length === 0 ? <EmptyState icon={Users} title={outstandingOnly ? "No outstanding balances" : "No students found"} description={search ? 'Try a different name, class, or registration number.' : canRegister ? 'Your student directory is ready for its first registration.' : 'No linked learners are available to your role.'} action={canRegister ? <Button onClick={() => setShowForm(true)}><UserPlus className="size-4" /> Register first student</Button> : undefined} /> : <><div className="hidden grid-cols-[1.6fr_1fr_.7fr_.8fr_.8fr_auto] gap-4 border-b border-[hsl(var(--border))] px-5 py-3 text-[10px] font-semibold uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))] md:grid"><span>Learner</span><span>Class</span><span>Attendance</span><span>Fees due</span><span>Status</span><span /></div><div className="divide-y divide-[hsl(var(--border))]">{students.map((student) => <Link href={`/students/${student.id}`} key={student.id} data-testid={`link-student-${student.id}`} className="grid items-center gap-3 px-5 py-4 transition-colors hover:bg-[hsl(var(--muted)/.5)] md:grid-cols-[1.6fr_1fr_.7fr_.8fr_.8fr_auto] md:gap-4"><div className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-xs font-bold text-[hsl(var(--primary))]">{student.firstName[0]}{student.lastName[0]}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{student.name}</span><span className="block font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{student.registrationNumber}</span>{student.isSponsored && <span className="block text-[10px] font-semibold text-[hsl(var(--primary))]">School-sponsored · no fees</span>}</span></div><span className="hidden text-sm md:block">{student.className} <span className="text-[hsl(var(--muted-foreground))]">{student.stream}</span></span><span className="text-xs text-[hsl(var(--muted-foreground))] md:text-sm"><span className="md:hidden">Attendance </span><b className={student.attendancePercentage < 80 ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--primary))'}>{student.attendancePercentage}%</b></span><span className="text-xs text-[hsl(var(--muted-foreground))] md:text-sm">{student.isSponsored ? 'No fees due' : money(student.feeBalance)}</span><span className={`w-fit rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${student.status === 'active' ? 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{student.status}</span><ArrowRight className="hidden size-4 text-[hsl(var(--muted-foreground))] md:block" /></Link>)}</div></>}</Panel>{showForm && canRegister && <Modal title="Register a student" description="Complete every section of the official pupil admission form. The registration number is generated automatically." onClose={() => setShowForm(false)} wide><form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><Field label="First name" value={form.firstName} onChange={(v) => update('firstName', v)} placeholder="First name" /><Field label="Middle name" value={form.middleName} onChange={(v) => update('middleName', v)} placeholder="Optional" required={false} /><Field label="Last name" value={form.lastName} onChange={(v) => update('lastName', v)} placeholder="Last name" /></div><div className="grid gap-4 sm:grid-cols-3"><Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={(v) => update('dateOfBirth', v)} /><SelectField label="Gender" value={form.gender} onChange={(v) => update('gender', v)} options={['Female', 'Male', 'Prefer not to say']} /><div className="grid grid-cols-2 gap-3"><SelectField label="Class applying for" value={form.className} onChange={(v) => update('className', v)} options={pupilClassOptions} /><SelectField label="Stream" value={form.stream} onChange={(v) => update('stream', v)} options={['A', 'B', 'C']} /></div></div><div className="grid gap-4 rounded-2xl bg-[hsl(var(--secondary)/.6)] p-4 sm:grid-cols-3"><SelectField label="Day or boarding" value={form.enrollmentType} onChange={(v) => update('enrollmentType', v)} options={['day', 'boarding']} /><SelectField label="Funding" value={form.isSponsored ? 'School-sponsored' : 'Fee-paying'} onChange={(v) => setForm((old) => ({ ...old, isSponsored: v === 'School-sponsored', ...(v === 'School-sponsored' ? { termFee: '', previousFeeBalance: '', initialPayment: '' } : {}) }))} options={['Fee-paying', 'School-sponsored']} /><Field label="Term fee (UGX)" type="number" value={form.termFee} onChange={(v) => update('termFee', v)} placeholder="0" /></div><div className="grid gap-4 rounded-2xl bg-[hsl(var(--muted)/.65)] p-4 sm:grid-cols-3"><Field label="Opening payment" type="number" value={form.initialPayment} onChange={(v) => update('initialPayment', v)} placeholder="0" /><SelectField label="Payment method" value={form.paymentMethod} onChange={(v) => update('paymentMethod', v)} options={['Cash', 'Mobile money', 'Bank transfer', 'Card']} /><Field label="Payment reference" value={form.paymentReference} onChange={(v) => update('paymentReference', v)} placeholder="Receipt or transaction number" required={false} /></div>{form.isSponsored && <p className="rounded-xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary)/.06)] p-3 text-xs leading-5 text-[hsl(var(--primary))]">This pupil is school-sponsored. The school will record zero fees, zero opening payment, and no receipt.</p>}<div className="rounded-2xl bg-[hsl(var(--muted)/.65)] p-4"><p className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-[hsl(var(--primary))]">Guardian contact</p><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name" value={form.guardianName} onChange={(v) => update('guardianName', v)} placeholder="Guardian name" /><Field label="Phone number" value={form.guardianPhone} onChange={(v) => update('guardianPhone', v)} placeholder="+256 7..." /></div></div><AdmissionDetailsFields form={form} update={update} declarationAccepted={form.declarationAccepted === true} onDeclarationChange={(accepted) => setForm((old) => ({ ...old, declarationAccepted: accepted }))} />{create.isError && <p className="text-sm text-[hsl(var(--destructive))]" data-testid="status-register-error">We couldn’t register this student. Please check the details.</p>}<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setShowForm(false)} testId="button-cancel-register">Cancel</Button><Button type="submit" disabled={create.isPending} testId="button-submit-register">{create.isPending ? 'Registering…' : 'Register student'}<ArrowRight className="size-4" /></Button></div></form></Modal>}</AppShell>;
}

function LegacyStudentProfilePage() {
  const { studentId = '' } = useParams<{ studentId: string }>();
  const [showReport, setShowReport] = useState(false);
  const profile = useGetStudent(studentId, { query: { enabled: !!studentId, queryKey: getGetStudentQueryKey(studentId) } });
  const report = useGetReportCard(studentId, { query: { enabled: showReport && !!studentId, queryKey: getGetReportCardQueryKey(studentId) } });
  const student = profile.data;
  return <AppShell><Link href="/students" data-testid="link-back-students" className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))] hover:underline"><ArrowLeft className="size-3.5" /> Back to student directory</Link>{profile.isError ? <Panel><ErrorState onRetry={() => profile.refetch()} /></Panel> : profile.isLoading ? <ProfileSkeleton /> : student ? <div className="space-y-6"><Panel className="overflow-hidden" testId="panel-student-profile"><div className="h-24 bg-[hsl(var(--sidebar))]" /><div className="px-5 pb-6 md:px-8"><div className="-mt-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-end gap-4"><span className="flex size-[74px] items-center justify-center rounded-3xl border-4 border-[hsl(var(--card))] bg-[hsl(var(--accent))] font-display text-2xl text-[hsl(var(--accent-foreground))]">{student.firstName[0]}{student.lastName[0]}</span><div className="pb-1"><h1 className="font-display text-3xl tracking-tight" data-testid="text-student-name">{student.name}</h1><p className="mt-1 font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{student.registrationNumber} · admitted {dateLabel(student.admissionDate)}</p></div></div><Button variant="secondary" onClick={() => setShowReport(true)} testId="button-view-report"><FileText className="size-4" /> View report card</Button></div><div className="mt-7 flex flex-wrap gap-2"><span className="rounded-full bg-[hsl(var(--primary)/.1)] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary))]">{student.className} · Stream {student.stream}</span><span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1.5 text-xs capitalize text-[hsl(var(--muted-foreground))]">{student.gender}</span><span className="rounded-full bg-[hsl(var(--primary)/.1)] px-3 py-1.5 text-xs font-semibold capitalize text-[hsl(var(--primary))]">{student.status}</span></div></div></Panel><div className="grid gap-6 lg:grid-cols-[.75fr_1.25fr]"><Panel className="p-6" testId="panel-student-details"><div className="mb-5 flex items-center gap-2"><Info className="size-4 text-[hsl(var(--primary))]" /><h2 className="font-display text-xl">Student details</h2></div><dl className="space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-[hsl(var(--muted-foreground))]">Date of birth</dt><dd className="font-medium">{dateLabel(student.dateOfBirth)}</dd></div><div className="flex justify-between gap-4"><dt className="text-[hsl(var(--muted-foreground))]">Guardian</dt><dd className="text-right font-medium">{student.guardianName}</dd></div><div className="flex justify-between gap-4"><dt className="text-[hsl(var(--muted-foreground))]">Phone</dt><dd className="font-mono-ui text-xs">{student.guardianPhone}</dd></div><div className="flex justify-between gap-4"><dt className="text-[hsl(var(--muted-foreground))]">Email</dt><dd className="max-w-[180px] truncate text-right font-medium">{student.guardianEmail}</dd></div></dl></Panel><Panel className="p-6" testId="panel-student-metrics"><div className="mb-5 flex items-center justify-between"><h2 className="font-display text-xl">At a glance</h2><span className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Current year</span></div><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-[hsl(var(--secondary)/.75)] p-4"><CalendarDays className="size-4 text-[hsl(var(--primary))]" /><p className="mt-5 font-display text-3xl">{student.attendancePercentage}%</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Attendance</p></div><div className="rounded-2xl bg-[hsl(var(--secondary)/.75)] p-4"><WalletCards className="size-4 text-[hsl(var(--chart-2))]" /><p className="mt-5 font-display text-3xl">{money(student.feeBalance)}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Fee balance</p></div><div className="rounded-2xl bg-[hsl(var(--secondary)/.75)] p-4"><BarChart3 className="size-4 text-[hsl(var(--chart-3))]" /><p className="mt-5 font-display text-3xl">{student.academicHistory?.[0]?.average ?? '—'}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Latest average</p></div></div></Panel></div><Panel className="overflow-hidden" testId="panel-academic-history"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-6"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--primary))]">Progress over time</p><h2 className="mt-1 font-display text-2xl">Academic history</h2></div><BadgeCheck className="size-5 text-[hsl(var(--accent-foreground))]" /></div>{student.academicHistory?.length ? <div className="divide-y divide-[hsl(var(--border))]">{student.academicHistory.map((item) => <div className="grid grid-cols-[1fr_auto_auto] items-center gap-6 p-5" key={item.term}><span className="text-sm font-semibold">{item.term}</span><span className="font-mono-ui text-sm text-[hsl(var(--muted-foreground))]">{item.average}%</span><span className="flex size-9 items-center justify-center rounded-full bg-[hsl(var(--primary)/.12)] font-display text-lg text-[hsl(var(--primary))]">{item.grade}</span></div>)}</div> : <EmptyState icon={BarChart3} title="No academic history yet" description="Results will appear here once a report card has been recorded." />}</Panel></div> : <Panel><EmptyState icon={Users} title="Student not found" description="This student may have moved or the link is incomplete." /></Panel>}{showReport && <Modal title="Current report card" description={report.data ? `${report.data.term} · ${report.data.academicYear}` : 'Loading the current report card'} onClose={() => setShowReport(false)} wide>{report.isLoading ? <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : report.isError ? <ErrorState onRetry={() => report.refetch()} /> : report.data ? <div><div className="mb-5 flex items-end justify-between rounded-2xl bg-[hsl(var(--secondary))] p-5"><div><p className="text-xs text-[hsl(var(--muted-foreground))]">Overall average</p><p className="font-display text-4xl text-[hsl(var(--primary))]">{report.data.overallAverage}%</p></div><span className="font-display text-4xl text-[hsl(var(--primary))]">{report.data.overallGrade}</span></div><div className="divide-y divide-[hsl(var(--border))] rounded-2xl border border-[hsl(var(--border))]">{report.data.subjects.map((subject) => <div className="grid grid-cols-[1fr_auto_auto] gap-3 p-3 text-sm" key={subject.subject}><span>{subject.subject}</span><span className="text-[hsl(var(--muted-foreground))]">{subject.score}/{subject.max}</span><b className="text-[hsl(var(--primary))]">{subject.grade}</b></div>)}</div><p className="mt-5 text-sm italic leading-6 text-[hsl(var(--muted-foreground))]">“{report.data.teacherComment}”</p><Button variant="secondary" className="mt-5 w-full" onClick={() => window.print()} testId="button-download-report"><Download className="size-4" /> Print report card</Button></div> : <EmptyState icon={FileText} title="Report card unavailable" description="There is no report card for the current term." />}</Modal>}</AppShell>;
}

function StudentProfilePage() {
  const { studentId = '' } = useParams<{ studentId: string }>();
  const { data: session } = useGetCurrentUser();
  const client = useQueryClient();
  const [showReport, setShowReport] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<StudentUpdateInput>({});
  const profile = useGetStudent(studentId, { query: { enabled: !!studentId, queryKey: getGetStudentQueryKey(studentId) } });
  const admission = useGetAdmissionForm(studentId, { query: { enabled: !!studentId, queryKey: getGetAdmissionFormQueryKey(studentId) } });
  const report = useGetReportCard(studentId, { query: { enabled: showReport && !!studentId, queryKey: getGetReportCardQueryKey(studentId) } });
  const canEdit = session?.user.role === 'administrator' || session?.user.role === 'super_admin';
  const payments = useListPayments({ query: { enabled: canEdit, queryKey: getListPaymentsQueryKey() } });
  const updateStudent = useUpdateStudent();
  const student = profile.data;
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState('');
  const operations = useGetOperations();
  const savedClassOptions = (operations.data?.modules?.classes || [])
    .map((item) => String(item.name || '').trim())
    .filter(Boolean);
  const classOptions = Array.from(new Set([
    ...(student?.className ? [student.className] : []),
    ...savedClassOptions,
    ...pupilClassOptions,
  ]));

  useEffect(() => {
    if (!student) return;
    setEditForm({
      firstName: student.firstName,
      middleName: '',
      lastName: student.lastName,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      className: student.className,
      stream: student.stream,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
      guardianEmail: student.guardianEmail,
      enrollmentType: student.enrollmentType,
      isSponsored: student.isSponsored,
      termFee: student.termFee,
       previousFeeBalance: student.previousFeeBalance,
      status: student.status,
      photoPath: student.photoPath,
      newPassword: '',
    });
  }, [student]);

  const updateField = (key: keyof StudentUpdateInput, value: string) => {
     setEditForm((old) => ({ ...old, [key]: key === 'isSponsored' ? value === 'School-sponsored' : key === 'termFee' || key === 'previousFeeBalance' ? Number(value) : value }));
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    updateStudent.mutate({ studentId, data: {
      ...editForm,
      middleName: editForm.middleName?.trim() || undefined,
      guardianEmail: editForm.guardianEmail?.trim() || '',
      stream: editForm.stream?.trim() || '',
      termFee: Number(editForm.termFee || 0),
       previousFeeBalance: Number(editForm.previousFeeBalance || 0),
      newPassword: editForm.newPassword || undefined,
    } }, {
      onSuccess: () => {
        setShowEdit(false);
        void profile.refetch();
        void admission.refetch();
        client.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        client.invalidateQueries({ queryKey: getGetOperationsQueryKey() });
      },
    });
  };
  const uploadPhoto = async (file: File) => {
    setPhotoUploadError('');
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      setPhotoUploadError('Choose a JPEG, PNG, or WebP image up to 5 MB.');
      return;
    }
    setPhotoUploading(true);
    try {
      const uploadFile = await normalizePupilPhoto(file);
      const urlResponse = await fetch('/api/storage/uploads/request-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: uploadFile.name, size: uploadFile.size, contentType: uploadFile.type }),
      });
      if (!urlResponse.ok) throw new Error('Upload URL unavailable');
      const upload = await urlResponse.json() as { uploadURL: string; objectPath: string };
      const uploadResponse = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': uploadFile.type }, body: uploadFile });
      if (!uploadResponse.ok) throw new Error('Photo upload failed');
      updateStudent.mutate({ studentId, data: { photoPath: upload.objectPath } }, {
        onSuccess: (updated) => {
          setEditForm((current) => ({ ...current, photoPath: updated.photoPath }));
          void profile.refetch();
          void admission.refetch();
          client.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        },
        onError: () => setPhotoUploadError('The pupil photo could not be saved. Please try again.'),
      });
    } catch {
      setPhotoUploadError('The pupil photo could not be uploaded. Please try again.');
    } finally {
      setPhotoUploading(false);
    }
  };
  const pupilPayments = payments.data?.filter((payment) => payment.studentId === student?.id) || [];

  return <AppShell>
    <Link href="/students" data-testid="link-back-students" className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))] hover:underline"><ArrowLeft className="size-3.5" /> Back to pupil directory</Link>
    {profile.isError ? <Panel><ErrorState onRetry={() => profile.refetch()} /></Panel> : profile.isLoading ? <ProfileSkeleton /> : student ? <div className="space-y-6">
      <Panel className="overflow-hidden" testId="panel-student-profile">
        <div className="h-24 bg-[hsl(var(--sidebar))]" />
        <div className="px-5 pb-6 md:px-8">
          <div className="-mt-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4"><span className="flex size-[74px] items-center justify-center rounded-3xl border-4 border-[hsl(var(--card))] bg-[hsl(var(--accent))] font-display text-2xl text-[hsl(var(--accent-foreground))]">{student.firstName[0]}{student.lastName[0]}</span><div className="pb-1"><h1 className="font-display text-3xl tracking-tight" data-testid="text-student-name">{student.name}</h1><p className="mt-1 font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{student.registrationNumber} · admitted {dateLabel(student.admissionDate)}</p></div></div>
            <div className="flex flex-wrap gap-2">{canEdit && <Button variant="secondary" onClick={() => setShowEdit(true)} testId="button-edit-student"><FileText className="size-4" /> Edit pupil</Button>}<Button variant="secondary" onClick={() => setShowReport(true)} testId="button-view-report"><FileText className="size-4" /> View report card</Button></div>
          </div>
             <div className="mt-7 flex flex-wrap gap-2"><span className="rounded-full bg-[hsl(var(--primary)/.1)] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary))]">{student.className}{student.stream ? ` · Stream ${student.stream}` : ''}</span><span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1.5 text-xs capitalize text-[hsl(var(--muted-foreground))]">{student.gender}</span><span className="rounded-full bg-[hsl(var(--primary)/.1)] px-3 py-1.5 text-xs font-semibold capitalize text-[hsl(var(--primary))]">{student.status}</span>{student.isSponsored && <span className="rounded-full bg-[hsl(var(--accent)/.18)] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--accent-foreground))]">School-sponsored · no fees</span>}</div>
        </div>
      </Panel>
      <Panel className="p-6 print:hidden" testId="panel-student-photo"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.4)]">{student.photoPath ? <img src={`/api/storage${student.photoPath}`} alt={`${student.name} passport photo`} className="h-full w-full object-cover" /> : <span className="px-3 text-center text-[10px] font-semibold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">No passport photo</span>}</div><div><p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Pupil identity</p><h2 className="mt-1 font-display text-xl">Passport photo</h2><p className="mt-1 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Upload a clear JPEG up to 5 MB. The saved photo is reused automatically on admission forms and report cards.</p><label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110"><Upload className="size-4" />{photoUploading || updateStudent.isPending ? 'Uploading…' : 'Upload passport photo'}<input type="file" accept="image/jpeg" className="sr-only" disabled={photoUploading || updateStudent.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadPhoto(file); event.currentTarget.value = ''; }} /></label>{photoUploadError && <p className="mt-2 text-xs text-[hsl(var(--destructive))]" role="alert">{photoUploadError}</p>}</div></div></Panel>
      <div className="grid gap-6 lg:grid-cols-[.75fr_1.25fr]">
        <Panel className="p-6" testId="panel-student-details"><div className="mb-5 flex items-center gap-2"><Info className="size-4 text-[hsl(var(--primary))]" /><h2 className="font-display text-xl">Personal information</h2></div><dl className="space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-[hsl(var(--muted-foreground))]">Date of birth</dt><dd className="font-medium">{dateLabel(student.dateOfBirth)}</dd></div><div className="flex justify-between gap-4"><dt className="text-[hsl(var(--muted-foreground))]">Guardian</dt><dd className="text-right font-medium">{student.guardianName}</dd></div><div className="flex justify-between gap-4"><dt className="text-[hsl(var(--muted-foreground))]">Phone</dt><dd className="font-mono-ui text-xs">{student.guardianPhone}</dd></div><div className="flex justify-between gap-4"><dt className="text-[hsl(var(--muted-foreground))]">Email</dt><dd className="max-w-[180px] truncate text-right font-medium">{student.guardianEmail || 'Not provided'}</dd></div></dl></Panel>
         <Panel className="p-6" testId="panel-student-metrics"><div className="mb-5 flex items-center justify-between"><h2 className="font-display text-xl">At a glance</h2><span className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Current year</span></div><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-[hsl(var(--secondary)/.75)] p-4"><CalendarDays className="size-4 text-[hsl(var(--primary))]" /><p className="mt-5 font-display text-3xl">{student.attendancePercentage}%</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Attendance</p></div><div className="rounded-2xl bg-[hsl(var(--secondary)/.75)] p-4"><WalletCards className="size-4 text-[hsl(var(--chart-2))]" /><p className="mt-5 font-display text-3xl">{student.isSponsored ? 'No fees' : money(student.feeBalance)}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{student.isSponsored ? 'School sponsorship' : 'Fee balance'}</p></div><div className="rounded-2xl bg-[hsl(var(--secondary)/.75)] p-4"><BarChart3 className="size-4 text-[hsl(var(--chart-3))]" /><p className="mt-5 font-display text-3xl">{student.academicHistory?.[0]?.average ?? '—'}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Latest average</p></div></div></Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="overflow-hidden" testId="panel-student-admission-form"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-6"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--primary))]">Saved document</p><h2 className="mt-1 font-display text-2xl">Admission form</h2></div><FileText className="size-5 text-[hsl(var(--primary))]" /></div><div className="p-6">{admission.isLoading ? <Skeleton className="h-20 w-full" /> : admission.data ? <><p className="text-sm font-semibold">{admission.data.pupilName}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Generated {dateLabel(admission.data.generatedAt)} · {admission.data.enrollmentType}</p><div className="mt-5 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => void downloadAdmissionForm(admission.data!)} testId="button-download-student-admission-form"><Download className="size-4" /> Download PDF</Button><Button variant="secondary" onClick={() => printAdmissionForm(admission.data!)} testId="button-print-student-admission-form"><Printer className="size-4" /> Print form</Button></div></> : <p className="text-sm text-[hsl(var(--muted-foreground))]">No saved admission form is available.</p>}</div></Panel>
        <Panel className="overflow-hidden" testId="panel-student-receipts"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-6"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--primary))]">Fee history</p><h2 className="mt-1 font-display text-2xl">Receipts</h2></div><Receipt className="size-5 text-[hsl(var(--primary))]" /></div>{!canEdit ? <p className="p-6 text-sm text-[hsl(var(--muted-foreground))]">Receipts are available to authorized finance users.</p> : payments.isLoading ? <div className="space-y-3 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : pupilPayments.length ? <div className="divide-y divide-[hsl(var(--border))]">{pupilPayments.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-mono-ui text-xs font-semibold">{payment.receiptNumber}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{payment.date} · {payment.method} · Balance {money(payment.balance)}</p></div><Link href={`/transactions/${payment.id}`} className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline">Open receipt</Link></div>)}</div> : <p className="p-6 text-sm text-[hsl(var(--muted-foreground))]">No receipts have been recorded for this pupil yet.</p>}</Panel>
      </div>
      <Panel className="overflow-hidden" testId="panel-academic-history"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-6"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--primary))]">Progress over time</p><h2 className="mt-1 font-display text-2xl">Academic history</h2></div><BadgeCheck className="size-5 text-[hsl(var(--accent-foreground))]" /></div>{student.academicHistory?.length ? <div className="divide-y divide-[hsl(var(--border))]">{student.academicHistory.map((item) => <div className="grid grid-cols-[1fr_auto_auto] items-center gap-6 p-5" key={item.term}><span className="text-sm font-semibold">{item.term}</span><span className="font-mono-ui text-sm text-[hsl(var(--muted-foreground))]">{item.average}%</span><span className="flex size-9 items-center justify-center rounded-full bg-[hsl(var(--primary)/.12)] font-display text-lg text-[hsl(var(--primary))]">{item.grade}</span></div>)}</div> : <EmptyState icon={BarChart3} title="No academic history yet" description="Results will appear here once a report card has been recorded." />}</Panel>
      {showEdit && <Modal title={`Edit ${student.name}`} description="Update the pupil's personal details, class placement, term fee, or pupil account password." onClose={() => setShowEdit(false)} wide><form onSubmit={save} className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><Field label="First name" value={String(editForm.firstName || '')} onChange={(value) => updateField('firstName', value)} /><Field label="Middle name" value={String(editForm.middleName || '')} onChange={(value) => updateField('middleName', value)} required={false} /><Field label="Last name" value={String(editForm.lastName || '')} onChange={(value) => updateField('lastName', value)} /></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Date of birth" type="date" value={String(editForm.dateOfBirth || '')} onChange={(value) => updateField('dateOfBirth', value)} /><SelectField label="Gender" value={String(editForm.gender || '')} onChange={(value) => updateField('gender', value)} options={['Female', 'Male', 'Prefer not to say']} /><SelectField label="Class" value={String(editForm.className || '')} onChange={(value) => updateField('className', value)} options={classOptions} /><Field label="Stream" value={String(editForm.stream || '')} onChange={(value) => updateField('stream', value)} required={false} /></div><div className="grid gap-4 rounded-2xl bg-[hsl(var(--secondary)/.6)] p-4 sm:grid-cols-3"><SelectField label="Pupil type" value={String(editForm.enrollmentType || 'day')} onChange={(value) => updateField('enrollmentType', value)} options={['day', 'boarding']} /><Field label="Term fee (UGX)" type="number" value={String(editForm.termFee ?? '')} onChange={(value) => updateField('termFee', value)} /><SelectField label="Status" value={String(editForm.status || 'active')} onChange={(value) => updateField('status', value)} options={['active', 'inactive']} /></div><div className="grid gap-4 sm:grid-cols-3"><Field label="Guardian name" value={String(editForm.guardianName || '')} onChange={(value) => updateField('guardianName', value)} /><Field label="Guardian phone" value={String(editForm.guardianPhone || '')} onChange={(value) => updateField('guardianPhone', value)} /><Field label="Guardian email" type="email" value={String(editForm.guardianEmail || '')} onChange={(value) => updateField('guardianEmail', value)} required={false} /></div><div className="rounded-2xl bg-[hsl(var(--muted)/.65)] p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[hsl(var(--primary))]">Pupil account</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Leave blank to keep the current pupil password.</p><div className="mt-3 max-w-md"><Field label="New pupil password" type="password" value={String(editForm.newPassword || '')} onChange={(value) => updateField('newPassword', value)} required={false} /></div></div>{updateStudent.isError && <p className="text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="status-edit-student-error">The pupil record could not be updated. Check the details and try again.</p>}<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setShowEdit(false)} testId="button-cancel-edit-student">Cancel</Button><Button type="submit" disabled={updateStudent.isPending} testId="button-save-student">{updateStudent.isPending ? 'Saving…' : 'Save pupil changes'}</Button></div></form></Modal>}
    </div> : <Panel><EmptyState icon={Users} title="Student not found" description="This pupil may have moved or the link is incomplete." /></Panel>}
    {showReport && <Modal title="Current report card" description={report.data ? `${report.data.term} · ${report.data.academicYear}` : 'Loading the current report card'} onClose={() => setShowReport(false)} wide>{report.isLoading ? <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : report.isError ? <ErrorState onRetry={() => report.refetch()} /> : report.data ? <div><div className="mb-5 flex items-end justify-between rounded-2xl bg-[hsl(var(--secondary))] p-5"><div><p className="text-xs text-[hsl(var(--muted-foreground))]">Overall average</p><p className="font-display text-4xl text-[hsl(var(--primary))]">{report.data.overallAverage}%</p></div><span className="font-display text-4xl text-[hsl(var(--primary))]">{report.data.overallGrade}</span></div><div className="divide-y divide-[hsl(var(--border))] rounded-2xl border border-[hsl(var(--border))]">{report.data.subjects.map((subject) => <div className="grid grid-cols-[1fr_auto_auto] gap-3 p-3 text-sm" key={subject.subject}><span>{subject.subject}</span><span className="text-[hsl(var(--muted-foreground))]">{subject.score}/{subject.max}</span><b className="text-[hsl(var(--primary))]">{subject.grade}</b></div>)}</div><p className="mt-5 text-sm italic leading-6 text-[hsl(var(--muted-foreground))]">“{report.data.teacherComment}”</p><Button variant="secondary" className="mt-5 w-full" onClick={() => window.print()} testId="button-download-report"><Download className="size-4" /> Print report card</Button></div> : <EmptyState icon={FileText} title="Report card unavailable" description="There is no report card for the current term." />}</Modal>}
  </AppShell>;
}

function AttendanceCreatePage() {
  const client = useQueryClient();
  const { data: session } = useGetCurrentUser();
  const [location, setLocation] = useLocation();
  const operations = useGetOperations();
  const createRegister = useCreateAttendanceRegister();
  const params = new URLSearchParams(location.split('?')[1] || '');
  const [date, setDate] = useState(params.get('date') || new Date().toISOString().slice(0, 10));
  const [selectedClass, setSelectedClass] = useState(params.get('className') || '');
  const classes = useMemo(() => (operations.data?.modules?.classes || []).map((item) => ({ id: String(item.id), name: String(item.name) })), [operations.data]);
  const students = useListStudents({ className: selectedClass, status: 'active' }, { query: { enabled: Boolean(selectedClass), queryKey: getListStudentsQueryKey({ className: selectedClass, status: 'active' }) } });
  const canCreate = session?.user.role === 'administrator' || session?.user.role === 'super_admin' || session?.user.role === 'teacher';

  useEffect(() => {
    if (selectedClass && classes.some((item) => item.name === selectedClass)) return;
    if (classes.length === 1) setSelectedClass(classes[0].name);
    else if (selectedClass) setSelectedClass('');
  }, [classes, selectedClass]);

  const create = () => {
    if (!selectedClass || !students.data?.length) return;
    createRegister.mutate({ data: { date, className: selectedClass } }, {
      onSuccess: () => {
        trackEvent('attendance_register_created', { class_name: selectedClass });
        client.invalidateQueries({ queryKey: getGetAttendanceQueryKey({ date, className: selectedClass }) });
        setLocation(`/attendance?className=${encodeURIComponent(selectedClass)}&date=${encodeURIComponent(date)}`);
      },
    });
  };

  return <AppShell>
    <Link href="/attendance" data-testid="link-back-attendance" className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))] hover:underline"><ArrowLeft className="size-3.5" /> Back to attendance</Link>
    <PageHeader eyebrow="Attendance setup" title="Create attendance register" description="Choose the class first. The active pupils in that class will be listed before you create today's register." />
    {!canCreate ? <Panel><ErrorState message="Only administrators and assigned teachers can create attendance registers." /></Panel> : <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
      <Panel className="p-6" testId="panel-attendance-class-selection">
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><CalendarDays className="size-5" /></span><div><h2 className="font-display text-2xl">Choose a class</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Teachers see only their assigned classes.</p></div></div>
        <label className="mt-6 block"><span className="mb-1.5 block text-xs font-semibold">Attendance date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3.5 text-sm outline-none" data-testid="input-create-attendance-date" /></label>
        <div className="mt-5"><span className="mb-1.5 block text-xs font-semibold">Class <span className="text-[hsl(var(--destructive))]">*</span></span>{operations.isLoading ? <Skeleton className="h-11 w-full" /> : classes.length ? <div className="grid gap-2">{classes.map((item) => <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${selectedClass === item.name ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.08)] font-semibold' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/.45)]'}`}><input type="radio" name="attendance-class" value={item.name} checked={selectedClass === item.name} onChange={() => setSelectedClass(item.name)} className="accent-[hsl(var(--primary))]" data-testid={`radio-attendance-class-${item.id}`} /><span>{item.name}</span></label>)}</div> : <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-4 text-sm text-[hsl(var(--muted-foreground))]">No assigned classes are available. Ask an administrator to create a class and assign it to you.</div>}</div>
        {selectedClass && <div className="mt-6 rounded-2xl bg-[hsl(var(--secondary)/.6)] p-4"><p className="text-xs text-[hsl(var(--muted-foreground))]">Selected class</p><p className="mt-1 font-display text-2xl text-[hsl(var(--primary))]">{selectedClass}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{students.isLoading ? 'Loading pupils…' : `${students.data?.length || 0} active pupil${students.data?.length === 1 ? '' : 's'} found`}</p></div>}
      </Panel>
      <Panel className="overflow-hidden" testId="panel-attendance-pupil-preview">
        <div className="border-b border-[hsl(var(--border))] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Pupil list</p><h2 className="mt-1 font-display text-2xl">{selectedClass ? `${selectedClass} pupils` : 'Select a class to continue'}</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">These active pupils will be included in the attendance register.</p></div>
        {!selectedClass ? <div className="p-6"><EmptyState icon={Users} title="No class selected" description="Select one of your assigned classes to list its pupils." /></div> : students.isError ? <div className="p-6"><ErrorState onRetry={() => students.refetch()} /></div> : students.isLoading ? <div className="space-y-3 p-6">{[1, 2, 3, 4, 5].map((item) => <Skeleton className="h-14 w-full" key={item} />)}</div> : students.data?.length ? <div className="divide-y divide-[hsl(var(--border))]">{students.data.map((student) => <div key={student.id} className="flex items-center gap-3 p-4" data-testid={`row-create-attendance-pupil-${student.id}`}><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-xs font-bold text-[hsl(var(--primary))]">{student.firstName[0]}{student.lastName[0]}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{student.name}</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{student.registrationNumber} · {student.className} · Stream {student.stream}</span></span><Check className="size-4 text-[hsl(var(--primary))]" /></div>)}</div> : <div className="p-6"><EmptyState icon={Users} title="No active pupils in this class" description="Register or reactivate pupils in this class before creating attendance." /></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--border))] p-5">{createRegister.isError && <p className="text-xs text-[hsl(var(--destructive))]" data-testid="status-create-attendance-error">The attendance register could not be created. Check that the class is assigned to you.</p>}<Button onClick={create} disabled={createRegister.isPending || !selectedClass || students.isLoading || !students.data?.length} testId="button-confirm-create-attendance">{createRegister.isPending ? 'Creating…' : 'Create attendance'}<ArrowRight className="size-4" /></Button></div>
      </Panel>
    </div>}
  </AppShell>;
}

function AttendancePage() {
  const client = useQueryClient();
  const { data: session } = useGetCurrentUser();
  const [location] = useLocation();
  const [date, setDate] = useState(() => new URLSearchParams(location.split('?')[1] || '').get('date') || new Date().toISOString().slice(0, 10));
  const [className, setClassName] = useState(() => new URLSearchParams(location.split('?')[1] || '').get('className') || '');
  const [local, setLocal] = useState<Record<string, AttendanceStatus>>({});
  const [arrivalTimes, setArrivalTimes] = useState<Record<string, string>>({});
  const operations = useGetOperations();
  const classOptions = useMemo(() => (operations.data?.modules?.classes || []).map((item) => String(item.name)), [operations.data]);
  const query = useGetAttendance({ date, className }, { query: { queryKey: getGetAttendanceQueryKey({ date, className }) } });
  const save = useSaveAttendance();
  const records = query.data || [];
  const setStatus = (record: AttendanceRecord, status: AttendanceStatus, arrivalTime = arrivalTimes[record.studentId] || record.arrivalTime || null) => {
    setLocal((old) => ({ ...old, [record.studentId]: status }));
    if (status === 'late' && !arrivalTime) return;
    save.mutate({ data: { studentId: record.studentId, date, status, arrivalTime } }, {
      onSuccess: () => {
        trackEvent('attendance_recorded', { status, class_name: className });
        client.invalidateQueries({ queryKey: getGetAttendanceQueryKey({ date, className }) });
      },
    });
  };
  useEffect(() => {
    setLocal({});
    setArrivalTimes(Object.fromEntries(records.map((record) => [record.studentId, record.arrivalTime || ''])));
  }, [date, className, records.length]);
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const requestedDate = params.get('date');
    const requestedClass = params.get('className');
    if (requestedDate) setDate(requestedDate);
    if (requestedClass) setClassName(requestedClass);
  }, [location]);
  useEffect(() => {
    if (className && classOptions.includes(className)) return;
    if (classOptions.length) setClassName(classOptions[0]);
  }, [className, classOptions]);
  const counts = records.reduce((acc, record) => {
    const status = local[record.studentId] || record.status;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const canCreate = session?.user.role === 'administrator' || session?.user.role === 'super_admin' || session?.user.role === 'teacher';
  return <AppShell>
    <PageHeader eyebrow="Daily register" title="Attendance" description="Select a class and date, then mark every pupil Present, Absent, or Late." action={<div className="flex flex-wrap gap-2">{canCreate && <Link href={`/attendance/create?date=${encodeURIComponent(date)}${className ? `&className=${encodeURIComponent(className)}` : ''}`}><Button testId="button-create-attendance"><Plus className="size-4" /> Create attendance</Button></Link>}<Button variant="secondary" onClick={() => query.refetch()} testId="button-refresh-attendance"><RefreshCcw className="size-4" /> Sync register</Button></div>} />
    <div className="mb-6 flex flex-col gap-3 sm:flex-row"><label className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3"><CalendarDays className="size-4 text-[hsl(var(--primary))]" /><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 bg-transparent text-sm outline-none" data-testid="input-attendance-date" /></label><div className="w-full sm:w-52"><SelectField label="Class" value={className} onChange={setClassName} options={classOptions.length ? classOptions : ['No assigned classes']} /></div></div>
    <div className="mb-6 grid grid-cols-3 gap-3">{[['Present', counts.present || 0, 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]'], ['Absent', counts.absent || 0, 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]'], ['Late', counts.late || 0, 'bg-[hsl(var(--accent)/.45)] text-[hsl(var(--accent-foreground))]']].map(([label, count, color]) => <Panel className="flex items-center justify-between p-4" key={String(label)}><span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span><span className={`flex size-9 items-center justify-center rounded-xl font-display text-xl ${color}`}>{count}</span></Panel>)}</div>
    <Panel className="overflow-hidden" testId="panel-attendance-register">{query.isError ? <ErrorState onRetry={() => query.refetch()} /> : query.isLoading ? <div className="space-y-3 p-6">{[1, 2, 3, 4, 5].map((i) => <Skeleton className="h-14 w-full" key={i} />)}</div> : records.length === 0 ? <EmptyState icon={CalendarDays} title="Register is empty" description={canCreate ? 'Select a class and date, then choose Create attendance to list every active pupil.' : 'No attendance register is available for this class and date.'} /> : <div className="divide-y divide-[hsl(var(--border))]">{records.map((record) => {
      const current = local[record.studentId] || record.status;
      const arrivalTime = arrivalTimes[record.studentId] || record.arrivalTime || '';
      return <div className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap sm:gap-5" key={record.id} data-testid={`row-attendance-${record.studentId}`}><div className="flex min-w-[190px] flex-1 items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-xs font-bold text-[hsl(var(--primary))]">{record.studentName.split(' ').map((n) => n[0]).join('').slice(0, 2)}</span><span><span className="block text-sm font-semibold">{record.studentName}</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{record.registrationNumber}</span></span></div><div className="flex flex-wrap items-center gap-2"><div className="flex gap-1.5 rounded-xl bg-[hsl(var(--muted)/.75)] p-1">{(['present', 'absent', 'late'] as AttendanceStatus[]).map((status) => <button key={status} onClick={() => setStatus(record, status)} data-testid={`button-attendance-${record.studentId}-${status}`} className={`rounded-lg px-2.5 py-2 text-[11px] font-semibold capitalize transition ${current === status ? status === 'present' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : status === 'absent' ? 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]' : 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}>{status}</button>)}</div>{current === 'late' && <label className="flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]"><span>Arrival</span><input type="time" value={arrivalTime} onChange={(event) => { const value = event.target.value; setArrivalTimes((old) => ({ ...old, [record.studentId]: value })); if (value) setStatus(record, 'late', value); }} className="h-9 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))]" required data-testid={`input-arrival-time-${record.studentId}`} /></label>}</div></div>;
    })}</div>}</Panel>
     {save.isPending && <p className="mt-3 text-right text-xs text-[hsl(var(--muted-foreground))]" data-testid="status-attendance-saving">Saving the latest register…</p>}
     {save.isError && <p className="mt-3 text-right text-xs text-[hsl(var(--destructive))]" data-testid="status-attendance-error">One attendance action could not be saved. Try again.</p>}
  </AppShell>;
}

function FinancePage() {
  const client = useQueryClient();
  const summary = useGetFinanceSummary();
  const payments = useListPayments();
  const students = useListStudents({ status: 'active' });
  const record = useRecordPayment();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', amount: '', method: 'Bank transfer', reference: '' });
  const [paymentReceipt, setPaymentReceipt] = useState<Payment | null>(null);
  const unpaidStudents = (students.data || []).filter((student) => student.feeBalance > 0);
  const selectedStudent = (students.data || []).find((student) => student.id === form.studentId);
  const receiptHistory = paymentReceipt ? (payments.data || []).filter((payment) => payment.studentId === paymentReceipt.studentId || payment.id === paymentReceipt.id) : [];
  const selectStudent = (studentId: string) => {
    const student = (students.data || []).find((item) => item.id === studentId);
    setForm((old) => ({ ...old, studentId, amount: student ? String(student.feeBalance) : '' }));
  };
  const financeCards: { label: string; value: string; Icon: typeof CircleDollarSign; color: string }[] = [
    { label: 'Collected this term', value: money(summary.data?.collected), Icon: CircleDollarSign, color: 'text-[hsl(var(--primary))]' },
    { label: 'Outstanding', value: money(summary.data?.outstanding), Icon: WalletCards, color: 'text-[hsl(var(--chart-4))]' },
    { label: 'Collection rate', value: `${summary.data?.collectionRate ?? 0}%`, Icon: BarChart3, color: 'text-[hsl(var(--chart-2))]' },
  ];
  const update = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const data = { ...form, amount: Number(form.amount) } as PaymentInput;
    record.mutate({ data }, {
       onSuccess: (payment) => {
        trackEvent('payment_recorded', { payment_method: data.method });
        client.invalidateQueries({ queryKey: getGetFinanceSummaryQueryKey() });
        client.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
         setShowForm(false);
          setPaymentReceipt(payment);
        setForm({ studentId: '', amount: '', method: 'Bank transfer', reference: '' });
      },
    });
  };
  return <AppShell><PageHeader eyebrow="Money desk" title="Finance" description="A clear view of what has come in, what is still due, and the latest receipts." action={<Button onClick={() => setShowForm(true)} testId="button-open-record-payment"><Plus className="size-4" /> Record payment</Button>} />{summary.isError ? <Panel><ErrorState onRetry={() => summary.refetch()} /></Panel> : <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3">{[['Collected this term', money(summary.data?.collected)], ['Outstanding', money(summary.data?.outstanding)], ['Collection rate', `${summary.data?.collectionRate ?? 0}%`]].map(([label, value]) => <Panel className="p-5" key={label}><span className="text-sm text-[hsl(var(--muted-foreground))]">{label}</span><p className="mt-5 font-display text-3xl">{summary.isLoading ? '—' : value}</p></Panel>)}</div><Panel className="overflow-hidden" testId="panel-unpaid-students"><div className="border-b border-[hsl(var(--border))] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--chart-4))]">Needs collection</p><h2 className="mt-1 font-display text-2xl">Pupils who have not paid in full</h2></div>{students.isLoading ? <div className="space-y-3 p-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : unpaidStudents.length ? <div className="divide-y divide-[hsl(var(--border))]">{unpaidStudents.map((student) => <button type="button" key={student.id} onClick={() => { selectStudent(student.id); setShowForm(true); }} className="flex w-full items-center gap-3 p-4 text-left hover:bg-[hsl(var(--muted)/.45)]"><span className="flex size-9 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-xs font-bold text-[hsl(var(--primary))]">{student.firstName[0]}{student.lastName[0]}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{student.name}</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{student.registrationNumber} · {student.className} {student.stream}</span></span><span className="text-right"><span className="block text-sm font-semibold text-[hsl(var(--chart-4))]">{money(student.feeBalance)}</span><span className="text-[10px] text-[hsl(var(--muted-foreground))]">outstanding</span></span><ArrowRight className="size-4 text-[hsl(var(--primary))]" /></button>)}</div> : <EmptyState icon={Check} title="No outstanding balances" description="Every active pupil is currently paid in full." />}</Panel><Panel className="overflow-hidden" testId="panel-recent-payments"><div className="border-b border-[hsl(var(--border))] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Latest receipts</p><h2 className="mt-1 font-display text-2xl">Recent payments</h2></div>{payments.isError ? <ErrorState onRetry={() => payments.refetch()} /> : payments.isLoading ? <div className="space-y-3 p-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : payments.data?.length ? <div className="divide-y divide-[hsl(var(--border))]">{payments.data.slice(0, 6).map((payment) => <Link href={`/transactions/${payment.id}`} className="flex items-center gap-3 p-4 hover:bg-[hsl(var(--muted)/.35)]" key={payment.id}><Receipt className="size-4 text-[hsl(var(--primary))]" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{payment.studentName}</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{payment.receiptNumber} · {dateLabel(payment.date)}</span></span><span className="text-right"><span className="block text-sm font-semibold">{money(payment.amount)}</span><span className="text-[10px] text-[hsl(var(--muted-foreground))]">Balance {money(payment.balance)}</span></span></Link>)}</div> : <EmptyState icon={Receipt} title="No payments yet" description="Recorded payments will create a clear receipt trail here." />}</Panel></div>}{showForm && <Modal title="Record a payment" description="Choose a pupil, confirm the amount, select the method, then issue the receipt." onClose={() => setShowForm(false)}><form onSubmit={submit} className="space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-semibold">Pupil *</span><select required value={form.studentId} onChange={(event) => selectStudent(event.target.value)} className="focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3.5 text-sm outline-none"><option value="" disabled>Choose a pupil who has a balance</option>{unpaidStudents.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.registrationNumber} · {money(student.feeBalance)} due</option>)}</select>{selectedStudent && <span className="mt-2 block font-mono-ui text-[10px] text-[hsl(var(--primary))]">Registration number: {selectedStudent.registrationNumber}</span>}</label><Field label="Amount" type="number" value={form.amount} onChange={(value) => update('amount', value)} placeholder="0.00" /><SelectField label="Payment method" value={form.method} onChange={(value) => update('method', value)} options={['Bank transfer', 'Cash', 'Card', 'Mobile money']} /><Field label="Reference" value={form.reference} onChange={(value) => update('reference', value)} placeholder="Transaction reference (optional)" required={false} />{record.isError && <p className="text-sm text-[hsl(var(--destructive))]">We couldn’t record this payment. Please check the amount and try again.</p>}<Button type="submit" disabled={record.isPending} className="mt-2 w-full">{record.isPending ? 'Saving receipt…' : 'Save payment'}<Check className="size-4" /></Button></form></Modal>}{paymentReceipt && <Modal title="Receipt ready" description="The payment was saved and the receipt number was generated automatically." onClose={() => setPaymentReceipt(null)}><div className="rounded-2xl border border-[hsl(var(--border))] p-5"><SchoolMark /><h2 className="mt-4 font-display text-xl">{SCHOOL_NAME}</h2><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Receipt number</dt><dd className="mt-1 font-mono-ui text-sm font-semibold">{paymentReceipt.receiptNumber}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Registration number</dt><dd className="mt-1 font-mono-ui text-sm font-semibold">{paymentReceipt.registrationNumber}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Pupil</dt><dd className="mt-1 text-sm font-semibold">{paymentReceipt.studentName}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Amount</dt><dd className="mt-1 font-display text-2xl text-[hsl(var(--primary))]">{money(paymentReceipt.amount)}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Balance</dt><dd className="mt-1 text-sm font-semibold">{money(paymentReceipt.balance)}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Date</dt><dd className="mt-1 text-sm font-semibold">{dateLabel(paymentReceipt.date)}</dd></div></dl><h3 className="mt-6 font-display text-lg">Payment history</h3><div className="mt-2 divide-y divide-[hsl(var(--border))]">{receiptHistory.map((payment) => <div key={payment.id} className="flex items-center justify-between py-2 text-xs"><span>{payment.date} · {payment.receiptNumber}</span><span className="font-semibold">{money(payment.amount)}</span></div>)}</div></div><div className="mt-5 flex gap-3"><Link href={`/transactions/${paymentReceipt.id}`} className="flex-1"><Button variant="secondary" className="w-full">Open full receipt</Button></Link><Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" /> Print</Button></div></Modal>}</AppShell>;
}

function AnnouncementsPage() {
  const client = useQueryClient();
  const announcements = useListAnnouncements();
  const create = useCreateAnnouncement();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', audience: 'Everyone', priority: AnnouncementInputPriority.normal });
  const update = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value as never }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({ data: form as AnnouncementInput }, {
      onSuccess: () => {
        trackEvent('announcement_published', { audience: form.audience, priority: form.priority });
        client.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });
        setShowForm(false);
        setForm({ title: '', body: '', audience: 'Everyone', priority: AnnouncementInputPriority.normal });
      },
    });
  };
  return <AppShell><PageHeader eyebrow="School voice" title="Announcements" description="Keep families and colleagues in step with what matters next." action={<Button onClick={() => setShowForm(true)} testId="button-open-announcement"><Plus className="size-4" /> New announcement</Button>} /><Panel className="overflow-hidden" testId="panel-announcements">{announcements.isError ? <ErrorState onRetry={() => announcements.refetch()} /> : announcements.isLoading ? <div className="space-y-4 p-6">{[1, 2, 3].map((i) => <Skeleton className="h-28 w-full" key={i} />)}</div> : announcements.data?.length ? <div className="divide-y divide-[hsl(var(--border))]">{announcements.data.map((item) => <article className="group p-5 transition-colors hover:bg-[hsl(var(--muted)/.35)] md:p-6" key={item.id} data-testid={`announcement-${item.id}`}><div className="flex gap-4"><span className={`mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl ${item.priority === 'important' ? 'bg-[hsl(var(--accent)/.5)] text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]'}`}><Megaphone className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-display text-xl">{item.title}</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{item.author} · {dateLabel(item.publishedAt)} · {item.audience}</p></div>{item.priority === 'important' && <span className="rounded-full bg-[hsl(var(--accent)/.55)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--accent-foreground))]">Important</span>}</div><p className="mt-4 max-w-3xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{item.body}</p></div><button className="hidden rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] sm:block" data-testid={`button-announcement-menu-${item.id}`}><MoreHorizontal className="size-4" /></button></div></article>)}</div> : <EmptyState icon={Megaphone} title="No announcements yet" description="When your school has something to share, it will live here." action={<Button onClick={() => setShowForm(true)}><Send className="size-4" /> Write an announcement</Button>} />}</Panel>{showForm && <Modal title="New announcement" description="Write clearly. People are busy." onClose={() => setShowForm(false)}><form onSubmit={submit} className="space-y-4"><Field label="Title" value={form.title} onChange={(v) => update('title', v)} placeholder="A short, useful headline" /><label className="block"><span className="mb-1.5 block text-xs font-semibold">Message <span className="text-[hsl(var(--destructive))]">*</span></span><textarea required value={form.body} onChange={(e) => update('body', e.target.value)} placeholder="What does your school community need to know?" className="focus-ring min-h-32 w-full resize-y rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] p-3.5 text-sm outline-none" data-testid="textarea-announcement-body" /></label><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Audience" value={form.audience} onChange={(v) => update('audience', v)} options={['Everyone', 'Teachers', 'Guardians', 'Students', 'Accountants']} /><SelectField label="Priority" value={form.priority} onChange={(v) => update('priority', v)} options={[AnnouncementInputPriority.normal, AnnouncementInputPriority.important]} /></div>{create.isError && <p className="text-sm text-[hsl(var(--destructive))]" data-testid="status-announcement-error">We couldn’t publish this announcement. Please try again.</p>}<Button type="submit" disabled={create.isPending} className="mt-2 w-full" testId="button-publish-announcement">{create.isPending ? 'Publishing…' : 'Publish announcement'}<Send className="size-4" /></Button></form></Modal>}</AppShell>;
}

function TimetablePage() {
  const client = useQueryClient();
  const { data: session } = useGetCurrentUser();
  const query = useGetTimetable();
  const operations = useGetOperations();
  const create = useCreateTimetableEntry();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TimetableInput>({ day: 'Monday', time: '08:00 - 09:00', subject: '', teacher: '', className: 'Primary 1', room: '' });
  const classes = operations.data?.modules.classes || [];
  const subjects = operations.data?.modules.subjects || [];
  const teachers = (operations.data?.modules.staff || []).filter((item) => item.role === 'teacher');
  const classOptions = classes.length ? classes.map((item) => `${item.name}${item.stream ? ` ${item.stream}` : ''}`) : pupilClassOptions;
  const subjectOptions = subjects.filter((item) => `${item.className}${item.stream ? ` ${item.stream}` : ''}` === form.className).map((item) => String(item.name));
  useEffect(() => {
    if (classOptions.length && !classOptions.includes(form.className)) {
      setForm((old) => ({ ...old, className: classOptions[0], subject: '' }));
    }
  }, [classOptions.join('|')]);
  const grouped = useMemo(() => (query.data || []).reduce((acc, entry) => { (acc[entry.day] ||= []).push(entry); return acc; }, {} as Record<string, NonNullable<typeof query.data>>), [query.data]);
  const update = (key: keyof TimetableInput, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({ data: form }, {
      onSuccess: () => {
        trackEvent('timetable_entry_created', { class_name: form.className });
        client.invalidateQueries({ queryKey: getGetTimetableQueryKey() });
        setShowForm(false);
        setForm({ day: 'Monday', time: '08:00 - 09:00', subject: '', teacher: '', className: 'Primary 1', room: '' });
      },
    });
  };
  const canCreate = session?.user.role === 'administrator' || session?.user.role === 'super_admin';
  return <AppShell><PageHeader eyebrow="Your week" title="My timetable" description="The shape of your teaching day, with enough breathing room to stay present." action={<div className="flex flex-wrap gap-2">{canCreate && <Button onClick={() => setShowForm(true)} testId="button-create-timetable"><Plus className="size-4" /> Create timetable</Button>}<Button variant="secondary" onClick={() => query.refetch()} testId="button-refresh-timetable"><RefreshCcw className="size-4" /> Refresh</Button></div>} />{query.isError ? <Panel><ErrorState onRetry={() => query.refetch()} /></Panel> : query.isLoading ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <Panel className="p-5" key={i}><Skeleton className="h-5 w-24" /><Skeleton className="mt-5 h-20 w-full" /><Skeleton className="mt-3 h-20 w-full" /></Panel>)}</div> : Object.keys(grouped).length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{Object.entries(grouped).map(([day, entries]) => <Panel className="overflow-hidden" key={day} testId={`panel-timetable-${day}`}><div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.45)] p-5"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">{entries.length} {entries.length === 1 ? 'session' : 'sessions'}</p><h2 className="mt-1 font-display text-2xl">{day}</h2></div><div className="divide-y divide-[hsl(var(--border))]">{entries.map((entry) => <div className="flex gap-3 p-4 transition-colors hover:bg-[hsl(var(--muted)/.45)]" key={entry.id}><span className="w-14 shrink-0 font-mono-ui text-[10px] leading-5 text-[hsl(var(--muted-foreground))]">{entry.time}</span><span className="mt-1 h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: entry.accent || 'hsl(var(--primary))' }} /><span className="min-w-0"><span className="block text-sm font-semibold">{entry.subject}</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{entry.className} · {entry.room}</span><span className="mt-2 block text-[11px] text-[hsl(var(--muted-foreground))]">{entry.teacher}</span></span></div>)}</div></Panel>)}</div> : <Panel><EmptyState icon={BookOpen} title="No timetable assigned" description={canCreate ? 'Create the first timetable entry for a class.' : 'Your teaching schedule will appear here when the school office assigns your classes.'} /></Panel>}{showForm && <Modal title="Create timetable entry" description="Choose values from the saved class, subject, and teacher records." onClose={() => setShowForm(false)}><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Day" value={form.day} onChange={(value) => update('day', value)} options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']} /><Field label="Time" value={form.time} onChange={(value) => update('time', value)} placeholder="08:00 - 09:00" />{subjectOptions.length ? <SelectField label="Subject" value={form.subject} onChange={(value) => update('subject', value)} options={subjectOptions} /> : <Field label="Subject" value={form.subject} onChange={(value) => update('subject', value)} placeholder="Select a class first" />}{teachers.length ? <SelectField label="Teacher" value={form.teacher} onChange={(value) => update('teacher', value)} options={teachers.map((teacher) => String(teacher.name))} /> : <Field label="Teacher" value={form.teacher} onChange={(value) => update('teacher', value)} placeholder="No teachers registered" />}{<SelectField label="Class" value={form.className} onChange={(value) => { update('className', value); update('subject', ''); }} options={classOptions} />}<Field label="Room" value={form.room} onChange={(value) => update('room', value)} placeholder="Room 1" /></div>{(!classes.length || !subjects.length || !teachers.length) && <p className="text-xs text-[hsl(var(--muted-foreground))]">Create the class, subject, and teacher records before saving a timetable entry.</p>}{create.isError && <p className="text-sm text-[hsl(var(--destructive))]">The timetable entry could not be saved.</p>}<Button type="submit" disabled={create.isPending || !classes.length || !subjects.length || !teachers.length} className="w-full" testId="button-submit-timetable">{create.isPending ? 'Saving…' : 'Save timetable entry'}<Check className="size-4" /></Button></form></Modal>}</AppShell>;
}

function LegacySettingsPage() {
  const [saved, setSaved] = useState(false);
  const [schoolName, setSchoolName] = useState('School name');
  const [email, setEmail] = useState('');
  return <AppShell><PageHeader eyebrow="Workspace" title="Settings" description="The small preferences that make the portal feel like your school." /><div className="grid gap-6 lg:grid-cols-[.72fr_1.28fr]"><Panel className="h-fit p-2" testId="panel-settings-nav"><button className="flex w-full items-center gap-3 rounded-xl bg-[hsl(var(--secondary))] px-4 py-3 text-left text-sm font-semibold" data-testid="button-settings-school"><GraduationCap className="size-4 text-[hsl(var(--primary))]" /> School profile</button><button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" data-testid="button-settings-account"><Users className="size-4" /> Account preferences</button><button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" data-testid="button-settings-security"><ShieldCheck className="size-4" /> Security</button></Panel><div className="space-y-6"><Panel className="p-6" testId="panel-school-profile"><div className="mb-6 flex items-start justify-between"><div><h2 className="font-display text-2xl">School profile</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">This is how your school appears across the workspace.</p></div><span className="flex size-10 items-center justify-center rounded-xl bg-[hsl(var(--accent)/.5)] text-[hsl(var(--accent-foreground))]"><GraduationCap className="size-5" /></span></div><div className="space-y-5"><Field label="School name" value={schoolName} onChange={setSchoolName} /><Field label="School office email" value={email} onChange={setEmail} type="email" /><SelectField label="Academic year" value="2024 / 2025" onChange={() => undefined} options={['2024 / 2025', '2025 / 2026']} /></div><div className="mt-6 flex items-center justify-between border-t border-[hsl(var(--border))] pt-5"><span className={`text-xs text-[hsl(var(--primary))] ${saved ? '' : 'invisible'}`} data-testid="status-settings-saved">Changes saved</span><Button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2400); }} testId="button-save-settings">Save changes</Button></div></Panel><Panel className="p-6" testId="panel-security-note"><div className="flex gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><LockKeyhole className="size-5" /></span><div><h2 className="font-display text-xl">A trusted workspace</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">The portal keeps role-based access and school records together, so the right people see the right details.</p><button className="mt-4 text-xs font-semibold text-[hsl(var(--primary))] hover:underline" data-testid="button-manage-security">Manage security preferences <ArrowRight className="ml-1 inline size-3" /></button></div></div></Panel></div></div></AppShell>;
}

function SettingsPage() {
  const client = useQueryClient();
  const { data: session } = useGetCurrentUser();
  const query = useGetSettings();
  const updateSettings = useUpdateSettings();
  const isAdmin = session?.user.role === 'administrator' || session?.user.role === 'super_admin';
  const [schoolName, setSchoolName] = useState(SCHOOL_NAME);
  const [academicYear, setAcademicYear] = useState('');
  const [currencyCode, setCurrencyCode] = useState('UGX');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (query.data) {
      setSchoolName(query.data.schoolName || SCHOOL_NAME);
      setAcademicYear(query.data.academicYear);
      setCurrencyCode(query.data.currencyCode || 'UGX');
      if (typeof document !== 'undefined') document.documentElement.dataset.currency = query.data.currencyCode || 'UGX';
    }
   }, [query.data]);

  const save = (event: FormEvent) => {
    event.preventDefault();
    updateSettings.mutate({ data: { schoolName, academicYear, currencyCode } }, {
      onSuccess: (settings) => {
        trackEvent('settings_updated', { currency: settings.currencyCode });
        client.setQueryData(getGetSettingsQueryKey(), settings);
        if (typeof window !== 'undefined') window.localStorage.setItem('schoolops.currency', settings.currencyCode);
        if (typeof document !== 'undefined') document.documentElement.dataset.currency = settings.currencyCode;
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2400);
      },
    });
  };

  return <AppShell><PageHeader eyebrow="Workspace" title="Settings" description="School configuration is shared across the workspace. Your role controls what can be changed." />{query.isError ? <Panel><ErrorState onRetry={() => query.refetch()} /></Panel> : query.isLoading ? <Panel className="space-y-4 p-6"><Skeleton className="h-7 w-48" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></Panel> : <div className="grid gap-6 lg:grid-cols-[.72fr_1.28fr]"><Panel className="h-fit p-2" testId="panel-settings-nav"><div className="flex items-center gap-3 rounded-xl bg-[hsl(var(--secondary))] px-4 py-3 text-sm font-semibold"><GraduationCap className="size-4 text-[hsl(var(--primary))]" /> School configuration</div><div className="mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]"><ShieldCheck className="size-4" /> Role-based access</div></Panel><div className="space-y-6"><Panel className="p-6" testId="panel-school-settings"><div className="mb-6 flex items-start justify-between"><div><h2 className="font-display text-2xl">{isAdmin ? 'School profile' : 'School configuration'}</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{isAdmin ? 'Keep the shared school details current for every team.' : 'These details are managed by your school administrator.'}</p></div><span className="flex size-10 items-center justify-center rounded-xl bg-[hsl(var(--accent)/.5)] text-[hsl(var(--accent-foreground))]"><GraduationCap className="size-5" /></span></div>{isAdmin ? <form onSubmit={save} className="space-y-5"><Field label="School name" value={schoolName} onChange={setSchoolName} /><Field label="Academic year" value={academicYear} onChange={setAcademicYear} /><SelectField label="Currency" value={currencyCode} onChange={setCurrencyCode} options={(query.data?.availableCurrencies || [{ code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh' }]).map((currency) => currency.code)} /><p className="text-xs text-[hsl(var(--muted-foreground))]">{query.data?.availableCurrencies.find((currency) => currency.code === currencyCode)?.name || 'Ugandan Shilling'} · used for fee and finance amounts</p>{updateSettings.isError && <p className="text-sm text-[hsl(var(--destructive))]" data-testid="status-settings-error">Settings could not be saved. Please try again.</p>}<div className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-5"><span className={`text-xs text-[hsl(var(--primary))] ${saved ? '' : 'invisible'}`} data-testid="status-settings-saved">Changes saved</span><Button type="submit" disabled={updateSettings.isPending} testId="button-save-settings">{updateSettings.isPending ? 'Saving…' : 'Save changes'}</Button></div></form> : <dl className="divide-y divide-[hsl(var(--border))] rounded-2xl border border-[hsl(var(--border))]"><div className="flex items-center justify-between gap-4 p-4"><dt className="text-sm text-[hsl(var(--muted-foreground))]">School name</dt><dd className="text-right text-sm font-semibold" data-testid="text-settings-school-name">{SCHOOL_NAME}</dd></div><div className="flex items-center justify-between gap-4 p-4"><dt className="text-sm text-[hsl(var(--muted-foreground))]">Academic year</dt><dd className="text-right text-sm font-semibold" data-testid="text-settings-academic-year">{query.data?.academicYear}</dd></div><div className="flex items-center justify-between gap-4 p-4"><dt className="text-sm text-[hsl(var(--muted-foreground))]">Currency</dt><dd className="text-right text-sm font-semibold" data-testid="text-settings-currency">{query.data?.currencyCode} · {query.data?.currencyName}</dd></div></dl>}</Panel><Panel className="p-6" testId="panel-school-branding"><div className="mb-5"><h2 className="font-display text-xl">School branding</h2><p className="mt-1 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Add your school logo for use across the workspace. Place the logo file at <code className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs">public/school-logo.png</code>.</p></div><div className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/.3)] p-5"><div className="text-center"><img src="/school-logo.png" alt={`${SCHOOL_NAME} school logo`} className="mx-auto max-h-24 max-w-[220px] object-contain" onError={(event) => { event.currentTarget.style.display = 'none'; }} /><p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">School logo placeholder</p></div></div><p className="mt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">The placeholder will be replaced automatically when <code className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs">school-logo.png</code> is available.</p></Panel><Panel className="p-6" testId="panel-security-note"><div className="flex gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><LockKeyhole className="size-5" /></span><div><h2 className="font-display text-xl">A trusted workspace</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">The portal keeps role-based access and school records together, so the right people see the right details.</p></div></div></Panel></div></div>}</AppShell>;
}

function ReportCardPage() {
  const { studentId = '' } = useParams<{ studentId: string }>();
  const profile = useGetStudent(studentId);
  const report = useGetReportCard(studentId);
  const operations = useGetOperations();
  const settings = useGetSettings();
  const create = useCreateReportCard();
  const [term, setTerm] = useState('Term 3');
  const [academicYear, setAcademicYear] = useState('');
  const [teacherComment, setTeacherComment] = useState('');
  const [rows, setRows] = useState<Array<{ subject: string; beginning: number; midterm: number; tests: number; endOfTerm: number; comment: string }>>([]);
  const student = profile.data;
   const classSubjects = (operations.data?.modules.subjects || []).filter((subject: OperationSubject) => subject.className === student?.className && (!student?.stream || !subject.stream || subject.stream === student.stream));
  useEffect(() => {
    if (report.data) {
      setTerm(report.data.term);
      setAcademicYear(report.data.academicYear);
      setTeacherComment(report.data.teacherComment);
      setRows(report.data.subjects.map((item) => ({ subject: item.subject, beginning: item.beginning, midterm: item.midterm, tests: item.tests, endOfTerm: item.endOfTerm, comment: item.comment })));
    } else if (operations.data && !rows.length) {
      setRows(classSubjects.map((subject) => ({ subject: subject.name, beginning: 0, midterm: 0, tests: 0, endOfTerm: 0, comment: '' })));
    }
  }, [report.data, operations.data]);
  useEffect(() => {
    if (settings.data?.academicYear && !academicYear) setAcademicYear(settings.data.academicYear);
  }, [settings.data, academicYear]);
  useEffect(() => {
    if (!student?.photoPath) return;
    const panel = document.querySelector('[data-testid="panel-report-card"]');
    const placeholder = Array.from(panel?.querySelectorAll('div') || []).find((element) => element.textContent?.trim() === 'Passportphoto');
    if (!placeholder) return;
    const image = document.createElement('img');
    image.src = `/api/storage${student.photoPath}`;
    image.alt = `${student.name} passport photo`;
    image.className = 'h-full w-full object-cover';
    placeholder.classList.add('overflow-hidden');
    placeholder.replaceChildren(image);
  }, [student?.photoPath, student?.name]);
  const updateRow = (index: number, key: string, value: string) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: key === 'subject' || key === 'comment' ? value : Math.max(0, Math.min(100, Number(value || 0))) } : row));
  const save = (event: FormEvent) => {
    event.preventDefault();
    const data: ReportCardInput = { term, academicYear, teacherComment, subjects: rows.filter((row) => row.subject.trim()).map((row) => ({ ...row, beginning: Number(row.beginning), midterm: Number(row.midterm), tests: Number(row.tests), endOfTerm: Number(row.endOfTerm) })) };
    create.mutate({ studentId, data }, { onSuccess: () => report.refetch() });
  };
  if (!student) return <AppShell><Panel className="p-8"><Skeleton className="h-8 w-56" /></Panel></AppShell>;
  return <AppShell><PageHeader eyebrow="Academic record" title="Report card" description="Enter each assessment component, then print a polished term report for the pupil." action={<div className="flex gap-2 print:hidden"><Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" /> Print / PDF</Button><Link href={`/students/${studentId}`}><Button variant="secondary"><ArrowLeft className="size-4" /> Back to pupil</Button></Link></div>} /><div className="mx-auto max-w-5xl space-y-6"><Panel className="overflow-hidden border-[hsl(var(--primary)/.2)] print:border-black" testId="panel-report-card"><div className="flex flex-col gap-5 border-b border-[hsl(var(--border))] bg-[linear-gradient(135deg,hsl(var(--primary)/.12),transparent)] p-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><SchoolMark /><div><p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[.18em] text-[hsl(var(--primary))]">Official academic report</p><h2 className="mt-1 font-display text-2xl">{SCHOOL_NAME}</h2><p className="text-sm text-[hsl(var(--muted-foreground))]">Powered by Corenexa Systems · {SCHOOL_POSTAL_ADDRESS}</p></div></div><div className="flex size-24 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-[hsl(var(--primary)/.4)] bg-[hsl(var(--card))] text-center text-[10px] font-semibold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Passport<br />photo</div></div><div className="grid gap-4 border-b border-[hsl(var(--border))] p-6 sm:grid-cols-4"><div className="sm:col-span-2"><p className="text-xs text-[hsl(var(--muted-foreground))]">Pupil</p><p className="mt-1 text-lg font-semibold">{student.name}</p><p className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{student.registrationNumber}</p></div><div><p className="text-xs text-[hsl(var(--muted-foreground))]">Class / stream</p><p className="mt-1 font-semibold">{student.className} · {student.stream || 'N/A'}</p></div><div><p className="text-xs text-[hsl(var(--muted-foreground))]">Term / year</p><p className="mt-1 font-semibold">{report.data?.term || term} · {report.data?.academicYear || academicYear || 'N/A'}</p></div></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-[hsl(var(--secondary)/.65)] text-left text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]"><tr><th className="px-5 py-3">Subject</th><th className="px-3 py-3 text-center">Beginning</th><th className="px-3 py-3 text-center">Midterm</th><th className="px-3 py-3 text-center">Tests</th><th className="px-3 py-3 text-center">End term</th><th className="px-3 py-3 text-center">Average</th><th className="px-5 py-3">Grade</th></tr></thead><tbody className="divide-y divide-[hsl(var(--border))]">{(report.data?.subjects || []).map((item) => <tr key={item.subject}><td className="px-5 py-3 font-medium">{item.subject}</td><td className="px-3 py-3 text-center">{item.beginning}</td><td className="px-3 py-3 text-center">{item.midterm}</td><td className="px-3 py-3 text-center">{item.tests}</td><td className="px-3 py-3 text-center">{item.endOfTerm}</td><td className="px-3 py-3 text-center font-semibold">{item.percentage}%</td><td className="px-5 py-3 font-semibold text-[hsl(var(--primary))]">{item.grade}</td></tr>)}</tbody></table></div><div className="grid gap-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)] p-6 sm:grid-cols-3"><div><p className="text-xs text-[hsl(var(--muted-foreground))]">Overall average</p><p className="mt-1 font-display text-2xl">{report.data?.overallAverage ?? 'N/A'}%</p></div><div><p className="text-xs text-[hsl(var(--muted-foreground))]">Class position</p><p className="mt-1 font-display text-2xl">{report.data?.position ? `${report.data.position}${report.data.position === 1 ? 'st' : report.data.position === 2 ? 'nd' : report.data.position === 3 ? 'rd' : 'th'}` : 'N/A'}</p></div><div><p className="text-xs text-[hsl(var(--muted-foreground))]">Overall grade</p><p className="mt-1 font-display text-2xl text-[hsl(var(--primary))]">{report.data?.overallGrade || 'N/A'}</p></div></div><div className="grid gap-6 p-6 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Teacher comment</p><p className="mt-2 min-h-16 rounded-xl border border-[hsl(var(--border))] p-3 text-sm">{report.data?.teacherComment || 'No comment recorded.'}</p></div><div className="grid grid-cols-2 gap-4 pt-8 text-center text-xs text-[hsl(var(--muted-foreground))]"><div className="border-t border-[hsl(var(--foreground)/.35)] pt-2">Class teacher</div><div className="border-t border-[hsl(var(--foreground)/.35)] pt-2">Head teacher</div></div></div></Panel><Panel className="p-6 print:hidden" testId="panel-report-entry"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="font-display text-2xl">Record assessment marks</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Each component is out of 100. The system calculates averages, grades, and class position.</p></div><FileBarChart className="size-6 text-[hsl(var(--primary))]" /></div><form onSubmit={save} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Term" value={term} onChange={setTerm} options={['Term 1', 'Term 2', 'Term 3']} /><Field label="Academic year" value={academicYear} onChange={setAcademicYear} placeholder="2026" /></div><div className="overflow-x-auto rounded-2xl border border-[hsl(var(--border))]"><table className="w-full min-w-[680px] text-sm"><thead className="bg-[hsl(var(--secondary)/.65)] text-left text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]"><tr><th className="px-4 py-3">Subject</th><th className="px-2 py-3">Beginning</th><th className="px-2 py-3">Midterm</th><th className="px-2 py-3">Tests</th><th className="px-2 py-3">End term</th><th /></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.subject}-${index}`} className="border-t border-[hsl(var(--border))]"><td className="px-4 py-2"><input className="focus-ring h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm" value={row.subject} onChange={(event) => updateRow(index, 'subject', event.target.value)} placeholder="Subject name" required /></td>{(['beginning', 'midterm', 'tests', 'endOfTerm'] as const).map((key) => <td key={key} className="px-2 py-2"><input type="number" min="0" max="100" className="focus-ring h-10 w-20 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 text-center text-sm" value={row[key]} onChange={(event) => updateRow(index, key, event.target.value)} required /></td>)}<td className="px-3"><button type="button" className="text-xs text-[hsl(var(--destructive))]" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3"><Button type="button" variant="secondary" onClick={() => setRows((current) => [...current, { subject: '', beginning: 0, midterm: 0, tests: 0, endOfTerm: 0, comment: '' }])}><Plus className="size-4" /> Add subject</Button><div className="flex items-center gap-3"><textarea value={teacherComment} onChange={(event) => setTeacherComment(event.target.value)} placeholder="Teacher comment" className="h-10 min-w-64 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm" /><Button type="submit" disabled={create.isPending || !rows.length}>{create.isPending ? 'Saving…' : 'Save report card'}<FileBarChart className="size-4" /></Button></div></div>{create.isError && <p className="text-sm text-[hsl(var(--destructive))]" role="alert">Report card could not be saved. Check the marks and try again.</p>}{create.isSuccess && <p className="text-sm text-[hsl(var(--primary))]" role="status">Report card saved successfully.</p>}</form></Panel></div></AppShell>;
}

export function TransactionDetailPage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const { data: session } = useGetCurrentUser();
  const client = useQueryClient();
  const query = useListPayments();
  const update = useUpdatePayment();
  const item = query.data?.find((payment) => payment.id === transactionId);
  const history = item ? (query.data || []).filter((payment) => payment.studentId === item.studentId) : [];
  const canPrint = session?.user.role === 'administrator' || session?.user.role === 'super_admin' || session?.user.permissions.includes('transactions_print');
  const canEdit = session?.user.role === 'administrator' || session?.user.role === 'super_admin' || session?.user.role === 'accountant' || session?.user.permissions.includes('finance_view');
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!item || editing) return;
    setAmount(String(item.amount));
    setMethod(item.method);
    setReference(item.reference);
  }, [item, editing]);

  const download = async () => {
    if (!item) return;
    const url = URL.createObjectURL(await receiptPdf(item, history));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${item.receiptNumber}.pdf`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const share = async () => {
    if (!item) return;
    const file = new File([await receiptPdf(item, history)], `${item.receiptNumber}.pdf`, { type: 'application/pdf' });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) await navigator.share({ title: item.receiptNumber, files: [file] });
    else if (navigator.clipboard) await navigator.clipboard.writeText(`Receipt ${item.receiptNumber}: ${item.studentName}, ${money(item.amount)}, ${item.date}. Download the PDF to share it.`);
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!item) return;
    update.mutate({ paymentId: item.id, data: { amount: Number(amount), method, reference } }, {
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetFinanceSummaryQueryKey() });
        void client.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        void client.invalidateQueries({ queryKey: getGetStudentQueryKey(item.studentId) });
        setEditing(false);
        setNotice('Transaction updated. The pupil balance and finance totals have been recalculated.');
      },
      onError: () => setNotice('The transaction could not be updated. Check the amount and try again.'),
    });
  };

  return <AppShell>{query.isLoading ? <Panel><Skeleton className="h-40" /></Panel> : !item ? <Panel><ErrorState message="That transaction could not be found." onRetry={() => query.refetch()} /></Panel> : <div className="mx-auto max-w-3xl"><Link href="/transactions" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--primary))] hover:underline"><ArrowLeft className="size-4" /> Back to transactions</Link>{notice && <p className="mb-5 rounded-xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.06)] px-4 py-3 text-sm" role="status">{notice}</p>}<Panel className="p-6 sm:p-10" testId="panel-transaction-detail"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[hsl(var(--border))] pb-6"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Official payment receipt</p><h1 className="mt-2 font-display text-3xl">{item.receiptNumber}</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">EMMECTY NURSERY & PRIMARY SCHOOL</p></div><span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs font-semibold capitalize text-[hsl(var(--primary))]">{item.status}</span></div><dl className="mt-8 grid gap-6 sm:grid-cols-2">{[['Pupil', item.studentName], ['Registration number', item.registrationNumber], ['Amount', money(item.amount)], ['Current balance', money(item.balance)], ['Payment method', item.method], ['Reference', item.reference || '—'], ['Date', item.date], ['Status', item.status]].map(([label, value]) => <div key={label}><dt className="text-[10px] font-semibold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{label}</dt><dd className={`mt-1 text-sm font-semibold ${label === 'Amount' ? 'font-display text-2xl text-[hsl(var(--primary))]' : ''}`}>{value}</dd></div>)}</dl>{editing && canEdit && <form onSubmit={save} className="mt-10 space-y-5 border-t border-[hsl(var(--border))] pt-6"><div><h2 className="font-display text-xl">Edit transaction</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Changing this amount recalculates the pupil’s amount paid, balance, collection totals, dashboard figures, and receipt history.</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-semibold">Amount<input className="focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm outline-none" type="number" min="0" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} data-testid="input-edit-transaction-amount" /></label><label className="space-y-2 text-sm font-semibold">Payment method<select className="focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm outline-none" required value={method} onChange={(event) => setMethod(event.target.value)} data-testid="select-edit-transaction-method">{['Bank transfer', 'Cash', 'Card', 'Mobile money'].map((option) => <option key={option}>{option}</option>)}</select></label><label className="space-y-2 text-sm font-semibold sm:col-span-2">Reference <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span><input className="focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm outline-none" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Transaction reference" data-testid="input-edit-transaction-reference" /></label></div><div className="flex flex-wrap gap-3"><Button type="submit" disabled={update.isPending} testId="button-save-transaction">{update.isPending ? 'Updating…' : 'Save transaction'}<Check className="size-4" /></Button><Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button></div></form>}<div className="mt-10 border-t border-[hsl(var(--border))] pt-6"><h2 className="font-display text-xl">Payment history</h2><div className="mt-3 divide-y divide-[hsl(var(--border))]">{history.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span><span className="block font-mono-ui text-xs font-semibold text-[hsl(var(--primary))]">{payment.receiptNumber}</span><span className="text-xs text-[hsl(var(--muted-foreground))]">{payment.date}</span></span><span className="font-semibold">{money(payment.amount)}</span></div>)}</div></div>{!editing && <div className="mt-10 flex flex-wrap gap-3 border-t border-[hsl(var(--border))] pt-6">{canEdit && <Button onClick={() => setEditing(true)} testId="button-edit-transaction"><Pencil className="size-4" /> Edit transaction</Button>}{canPrint && <><Button variant="secondary" onClick={() => receiptPrintPage(item, history)} testId="button-print-transaction"><Printer className="size-4" /> Print</Button><Button variant="secondary" onClick={download} testId="button-download-transaction"><Download className="size-4" /> Download PDF</Button><Button variant="secondary" onClick={() => void share()} testId="button-share-transaction"><Share2 className="size-4" /> Share PDF</Button></>}</div>}</Panel></div>}</AppShell>;
}

export { AnnouncementsPage, AttendanceCreatePage, AttendancePage, DashboardPage, FinancePage, LoginPage, ReportCardPage, SettingsPage, StudentProfilePage, StudentsPage, SupportPage, TimetablePage, UserManualPage };