import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetCurrentUserQueryKey, useGetCurrentUser, useLogout } from '@workspace/api-client-react';
import { BookOpen, CalendarDays, ChevronDown, CircleDollarSign, GraduationCap, LayoutDashboard, LogOut, Menu, Megaphone, PanelLeftClose, PanelLeftOpen, Search, Settings, ShieldCheck, UserRound, Users, X } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/students', label: 'Students', icon: Users },
  { href: '/attendance', label: 'Attendance', icon: CalendarDays },
  { href: '/finance', label: 'Finance', icon: CircleDollarSign },
  { href: '/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/timetable', label: 'My timetable', icon: BookOpen },
];

function Initials({ name, className = '' }: { name: string; className?: string }) {
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SO';
  return <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-xs font-bold text-[hsl(var(--accent-foreground))] ${className}`} data-testid="avatar-user">{initials}</span>;
}

export function SchoolMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" data-testid="brand-schoolops">
      <span className="relative flex size-10 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-sm">
        <GraduationCap className="size-5" strokeWidth={2.3} />
        <span className="absolute -right-1 -top-1 size-2 rounded-full bg-[hsl(var(--primary))]" />
      </span>
      {!compact && <span className="font-display text-xl tracking-tight">School<span className="text-[hsl(var(--accent))]">Ops</span></span>}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const client = useQueryClient();
  const { data: session, isLoading } = useGetCurrentUser();
  const logout = useLogout();
  const user = session?.user;
  const displayName = user?.name || 'School administrator';
  const roleLabel = (user?.role || 'administrator').replace('_', ' ');

  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => { client.removeQueries({ queryKey: getGetCurrentUserQueryKey() }); setLocation('/'); } });
  };

  return (
    <div className="flex min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {mobileOpen && <button aria-label="Close navigation" data-testid="button-close-mobile-nav" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-[hsl(var(--foreground)/.32)] md:hidden" />}
      <aside className={`sidebar-shadow fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-[82px]' : ''}`}>
        <div className="flex h-[82px] items-center justify-between border-b border-[hsl(var(--sidebar-border))] px-5">
          <SchoolMark compact={collapsed} />
          <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-[hsl(var(--sidebar-foreground)/.7)] hover:bg-[hsl(var(--sidebar-accent))] md:hidden" data-testid="button-close-sidebar"><X className="size-4" /></button>
        </div>
        <div className={`border-b border-[hsl(var(--sidebar-border))] px-4 py-5 ${collapsed ? 'md:px-3' : ''}`}>
          <div className={`flex items-center gap-3 rounded-xl bg-[hsl(var(--sidebar-accent)/.65)] p-3 ${collapsed ? 'md:justify-center md:p-2' : ''}`}>
            <Initials name={displayName} />
            <div className={`${collapsed ? 'md:hidden' : ''} min-w-0`}>
              <p className="truncate text-sm font-semibold" data-testid="text-sidebar-user">{isLoading ? 'Loading profile' : displayName}</p>
              <p className="mt-0.5 truncate text-[11px] capitalize text-[hsl(var(--sidebar-foreground)/.6)]" data-testid="text-sidebar-role">{roleLabel}</p>
            </div>
            <ChevronDown className={`ml-auto size-4 text-[hsl(var(--sidebar-foreground)/.45)] ${collapsed ? 'md:hidden' : ''}`} />
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Primary navigation">
          <p className={`mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.42)] ${collapsed ? 'md:hidden' : ''}`}>Workspace</p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href || (href === '/students' && location.startsWith('/students/'));
            return <Link href={href} key={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? 'bg-[hsl(var(--sidebar-primary))] font-semibold text-[hsl(var(--sidebar-primary-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.68)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]'} ${collapsed ? 'md:justify-center md:px-2' : ''}`}>
              <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.4 : 1.8} /><span className={collapsed ? 'md:hidden' : ''}>{label}</span>{active && !collapsed && <span className="ml-auto size-1.5 rounded-full bg-[hsl(var(--sidebar-primary-foreground)/.55)]" />}
            </Link>;
          })}
          <p className={`mb-3 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.42)] ${collapsed ? 'md:hidden' : ''}`}>School</p>
          <Link href="/settings" onClick={() => setMobileOpen(false)} data-testid="link-nav-settings" className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[hsl(var(--sidebar-foreground)/.68)] transition-colors hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))] ${location === '/settings' ? 'bg-[hsl(var(--sidebar-primary))] font-semibold text-[hsl(var(--sidebar-primary-foreground))]' : ''} ${collapsed ? 'md:justify-center md:px-2' : ''}`}><Settings className="size-[18px] shrink-0" /><span className={collapsed ? 'md:hidden' : ''}>Settings</span></Link>
        </nav>
        <div className={`border-t border-[hsl(var(--sidebar-border))] p-3 ${collapsed ? 'md:px-2' : ''}`}>
          <div className={`mb-2 flex items-center gap-2 px-3 py-2 text-[11px] text-[hsl(var(--sidebar-foreground)/.48)] ${collapsed ? 'md:hidden' : ''}`}><ShieldCheck className="size-3.5 text-[hsl(var(--accent))]" /> Secure school workspace</div>
          <button onClick={handleLogout} disabled={logout.isPending} data-testid="button-logout" className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[hsl(var(--sidebar-foreground)/.65)] transition-colors hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))] ${collapsed ? 'md:justify-center md:px-2' : ''}`}><LogOut className="size-[18px] shrink-0" /><span className={collapsed ? 'md:hidden' : ''}>{logout.isPending ? 'Signing out…' : 'Sign out'}</span></button>
        </div>
      </aside>
      <div className={`flex min-w-0 flex-1 flex-col transition-[margin] duration-300 md:ml-[264px] ${collapsed ? 'md:ml-[82px]' : ''}`}>
        <header className="sticky top-0 z-20 flex h-[82px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.92)] px-5 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] md:hidden" data-testid="button-open-mobile-nav"><Menu className="size-5" /></button>
            <button onClick={() => setCollapsed(!collapsed)} className="hidden rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] md:block" data-testid="button-toggle-sidebar">{collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}</button>
            <div className="hidden items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))] lg:flex"><Search className="size-3.5" /><span>Search SchoolOps</span><kbd className="ml-5 rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 font-mono text-[10px]">⌘ K</kbd></div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/settings" data-testid="link-header-profile" className="group flex items-center gap-2.5 rounded-xl p-1.5 pr-2 transition-colors hover:bg-[hsl(var(--muted))]"><Initials name={displayName} className="size-8" /><span className="hidden text-left sm:block"><span className="block max-w-[140px] truncate text-xs font-semibold">{displayName}</span><span className="block text-[10px] capitalize text-[hsl(var(--muted-foreground))]">{roleLabel}</span></span></Link>
          </div>
        </header>
        <main className="app-grid flex-1 overflow-x-hidden"><div className="mx-auto w-full max-w-[1480px] p-5 md:p-8">{children}</div></main>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end animate-rise-in"><div><p className="mb-2 font-mono-ui text-[10px] font-semibold uppercase tracking-[.2em] text-[hsl(var(--primary))]">{eyebrow || 'SchoolOps'}</p><h1 className="font-display text-4xl leading-none tracking-[-.035em] text-[hsl(var(--foreground))] md:text-5xl" data-testid="text-page-title">{title}</h1>{description && <p className="mt-3 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]" data-testid="text-page-description">{description}</p>}</div>{action && <div className="shrink-0">{action}</div>}</div>;
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