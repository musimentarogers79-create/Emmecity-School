import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff, Save, ShieldCheck, UserRound } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
  useUpdateCurrentUser,
} from '@workspace/api-client-react';
import { AppShell, Button, PageHeader, Panel, Skeleton } from '@/components/school-shell';

function ProfileField({ label, value, onChange, type = 'text', autoComplete, required = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[hsl(var(--foreground))]">{label}</span>
      <span className="relative block">
        <input
          type={isPassword && visible ? 'text' : type}
          value={value}
          required={required}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className={`focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3.5 text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))] ${isPassword ? 'pr-12' : ''}`}
          data-testid={`input-profile-${label.toLowerCase().replaceAll(' ', '-')}`}
        />
        {isPassword && (
          <button type="button" onClick={() => setVisible((shown) => !shown)} aria-label={visible ? `Hide ${label}` : `Show ${label}`} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[hsl(var(--primary))]">
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </span>
    </label>
  );
}

export function ProfilePage() {
  const client = useQueryClient();
  const session = useGetCurrentUser();
  const updateProfile = useUpdateCurrentUser();
  const [form, setForm] = useState({ name: '', identifier: '', email: '', phone: '', currentPassword: '', newPassword: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!session.data?.user) return;
    const user = session.data.user;
    setForm((current) => ({
      ...current,
      name: user.name,
      identifier: user.identifier,
      email: user.email,
      phone: user.phone,
    }));
  }, [session.data?.user]);

  const change = (key: keyof typeof form, value: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    updateProfile.mutate({
      data: {
        name: form.name,
        identifier: form.identifier,
        email: form.email,
        phone: form.phone,
        ...(form.newPassword ? { currentPassword: form.currentPassword, newPassword: form.newPassword } : {}),
      },
    }, {
      onSuccess: (nextSession) => {
        client.setQueryData(getGetCurrentUserQueryKey(), nextSession);
        setForm((current) => ({ ...current, currentPassword: '', newPassword: '' }));
        setSaved(true);
      },
    });
  };

  return (
    <AppShell>
      <PageHeader eyebrow="My account" title="Profile information" description="Update your personal details, sign-in username, and password." />
      {session.isLoading ? <Panel className="p-6"><Skeleton className="h-72 w-full" /></Panel> : (
        <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_.72fr]">
          <Panel className="p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><UserRound className="size-5" /></span>
              <div><h2 className="font-display text-2xl">Personal details</h2><p className="text-sm text-[hsl(var(--muted-foreground))]">These details identify you throughout the system.</p></div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <ProfileField label="Full name" value={form.name} onChange={(value) => change('name', value)} required />
              <ProfileField label="Username" value={form.identifier} onChange={(value) => change('identifier', value)} autoComplete="username" required />
              <ProfileField label="Email" value={form.email} onChange={(value) => change('email', value)} type="email" autoComplete="email" />
              <ProfileField label="Contact number" value={form.phone} onChange={(value) => change('phone', value)} type="tel" autoComplete="tel" />
            </div>
          </Panel>
          <Panel className="p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><ShieldCheck className="size-5" /></span>
              <div><h2 className="font-display text-2xl">Change password</h2><p className="text-sm text-[hsl(var(--muted-foreground))]">Leave both fields empty to keep your password.</p></div>
            </div>
            <div className="space-y-5">
              <ProfileField label="Current password" value={form.currentPassword} onChange={(value) => change('currentPassword', value)} type="password" autoComplete="current-password" required={!!form.newPassword} />
              <ProfileField label="New password" value={form.newPassword} onChange={(value) => change('newPassword', value)} type="password" autoComplete="new-password" />
              {updateProfile.isError && <p className="rounded-xl bg-[hsl(var(--destructive)/.1)] p-3 text-sm font-medium text-[hsl(var(--destructive))]">The profile was not updated. Check your current password and username.</p>}
              {saved && <p className="rounded-xl bg-[hsl(var(--primary)/.1)] p-3 text-sm font-medium text-[hsl(var(--primary))]">Profile updated successfully.</p>}
              <Button type="submit" disabled={updateProfile.isPending} className="w-full" testId="button-save-profile"><Save className="size-4" />{updateProfile.isPending ? 'Saving…' : 'Save profile'}</Button>
            </div>
          </Panel>
        </form>
      )}
    </AppShell>
  );
}