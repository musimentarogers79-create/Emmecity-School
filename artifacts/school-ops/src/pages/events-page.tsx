import { useEffect, useMemo, useState } from 'react';
import type { EventInput, OperationEvent } from '@workspace/api-client-react';
import { getGetOperationsQueryKey, useCreateEvent, useGetCurrentUser, useGetOperations } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock3, Download, ExternalLink, Filter, MapPin, Megaphone, Plus, RefreshCcw, Search, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { Button, EmptyState, ErrorState, PageHeader, Panel, AppShell } from '@/components/school-shell';
import { SearchableSelect } from '@/components/searchable-select';
import { trackEvent } from '@/lib/analytics';

type RSVP = 'attending' | 'interested';
type EventRecord = OperationEvent & {
  description?: string;
  host?: string;
  hostRole?: string;
  hostContact?: string;
  attendeeLimit?: number;
  attendees?: Array<{ name: string; response: RSVP }>;
};

const eventTypes = ['School event', 'Parent meeting', 'Staff meeting', 'Sports', 'Training', 'Public holiday', 'Other'];
const dateRanges = ['all', 'next-30', 'this-month', 'past'] as const;
type DateRange = typeof dateRanges[number];
const inputClass = 'focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm outline-none';
const textAreaClass = 'focus-ring min-h-24 w-full resize-y rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] p-3 text-sm outline-none';

const toRecord = (event: OperationEvent) => event as EventRecord;
const dateKey = (value: string) => value.slice(0, 10);
const dateObject = (value: string) => new Date(value.length === 10 ? `${value}T12:00:00` : value);
const formatEventDate = (value: string) => new Intl.DateTimeFormat('en-UG', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: value.length > 10 ? '2-digit' : undefined, minute: value.length > 10 ? '2-digit' : undefined }).format(dateObject(value));
const formatMonth = (value: Date) => new Intl.DateTimeFormat('en-UG', { month: 'long', year: 'numeric' }).format(value);
const isoDay = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const calendarKey = (userId?: string) => `schoolops.event-reminders.${userId || 'device'}`;
const responseKey = (userId?: string) => `schoolops.event-rsvps.${userId || 'device'}`;

function CreateEventForm({ onDone }: { onDone: () => void }) {
  const client = useQueryClient();
  const create = useCreateEvent();
  const session = useGetCurrentUser();
  const [form, setForm] = useState<EventInput>({
    title: '',
    date: '',
    type: 'School event',
    location: '',
    status: 'Upcoming',
    description: '',
    host: session.data?.user.name || '',
    hostRole: '',
    hostContact: '',
    attendeeLimit: undefined,
  });
  const [otherType, setOtherType] = useState('');
  const update = (key: keyof EventInput, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const type = form.type === 'Other' ? otherType.trim() : form.type;
    if (!type) return;
    const payload: EventInput = {
      ...form,
      type,
      title: form.title.trim(),
      location: form.location.trim(),
      ...(form.description?.trim() ? { description: form.description.trim() } : {}),
      ...(form.host?.trim() ? { host: form.host.trim() } : {}),
      ...(form.hostRole?.trim() ? { hostRole: form.hostRole.trim() } : {}),
      ...(form.hostContact?.trim() ? { hostContact: form.hostContact.trim() } : {}),
      ...(form.attendeeLimit ? { attendeeLimit: Number(form.attendeeLimit) } : {}),
    };
    create.mutate({ data: payload }, {
      onSuccess: () => {
        trackEvent('school_event_created', { event_type: type });
        client.invalidateQueries({ queryKey: getGetOperationsQueryKey() });
        onDone();
      },
    });
  };
  return <Panel className="border-dashed p-5" testId="panel-create-event">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Plus className="size-4" /></span><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">School calendar</p><h2 className="mt-1 font-display text-xl">Add an event</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">Give families and staff enough detail to know where to go, who is hosting, and how to take part.</p></div></div>
      <span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Admin and secretary</span>
    </div>
    <form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-2">
      <label className="text-xs font-semibold md:col-span-2">Event title<input required value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="e.g. Term 3 parents meeting" className={`${inputClass} mt-1`} data-testid="input-event-title" /></label>
      <label className="text-xs font-semibold">Date and time<input required type="datetime-local" value={form.date} onChange={(event) => update('date', event.target.value)} className={`${inputClass} mt-1`} data-testid="input-event-date" /></label>
      <label className="text-xs font-semibold">Category<select value={form.type} onChange={(event) => update('type', event.target.value)} className={`${inputClass} mt-1`} data-testid="select-event-type">{eventTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
      {form.type === 'Other' && <label className="text-xs font-semibold">Custom category<input required value={otherType} onChange={(event) => setOtherType(event.target.value)} placeholder="Event category" className={`${inputClass} mt-1`} data-testid="input-event-custom-type" /></label>}
      <label className="text-xs font-semibold">Location or meeting link<input required value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="School hall, classroom, or online link" className={`${inputClass} mt-1`} data-testid="input-event-location" /></label>
      <label className="text-xs font-semibold">Attendee limit <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span><input type="number" min="1" value={form.attendeeLimit ?? ''} onChange={(event) => setForm((current) => ({ ...current, attendeeLimit: event.target.value ? Number(event.target.value) : undefined }))} placeholder="No limit" className={`${inputClass} mt-1`} data-testid="input-event-attendee-limit" /></label>
      <label className="text-xs font-semibold">Host name<input value={form.host || ''} onChange={(event) => update('host', event.target.value)} placeholder="Person or department" className={`${inputClass} mt-1`} data-testid="input-event-host" /></label>
      <label className="text-xs font-semibold">Host role or department<input value={form.hostRole || ''} onChange={(event) => update('hostRole', event.target.value)} placeholder="e.g. School administration" className={`${inputClass} mt-1`} data-testid="input-event-host-role" /></label>
      <label className="text-xs font-semibold">Host contact <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span><input value={form.hostContact || ''} onChange={(event) => update('hostContact', event.target.value)} placeholder="Phone or email" className={`${inputClass} mt-1`} data-testid="input-event-host-contact" /></label>
      <label className="text-xs font-semibold md:col-span-2">Description<textarea value={form.description || ''} onChange={(event) => update('description', event.target.value)} placeholder="What should attendees know before they arrive?" className={`${textAreaClass} mt-1`} data-testid="textarea-event-description" /></label>
      {create.isError && <p className="text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="status-event-error">The event could not be saved. Check the required details and try again.</p>}
      <div className="flex flex-wrap justify-end gap-2 md:col-span-2"><Button type="button" variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit" disabled={create.isPending} testId="button-save-event">{create.isPending ? 'Saving…' : 'Save event'}<Check className="size-4" /></Button></div>
    </form>
  </Panel>;
}

function CalendarGrid({ events, month, onMonthChange, onSelect }: { events: EventRecord[]; month: Date; onMonthChange: (month: Date) => void; onSelect: (event: EventRecord) => void }) {
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [month]);
  const eventsByDay = useMemo(() => events.reduce((map, event) => {
    const key = dateKey(event.date);
    map.set(key, [...(map.get(key) || []), event]);
    return map;
  }, new Map<string, EventRecord[]>()), [events]);
  return <Panel className="overflow-hidden" testId="panel-event-calendar">
    <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Calendar</p><h2 className="mt-1 font-display text-xl">{formatMonth(month)}</h2></div><div className="flex gap-1"><Button variant="quiet" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month" testId="button-previous-month"><ChevronLeft className="size-4" /></Button><Button variant="quiet" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month" testId="button-next-month"><ChevronRight className="size-4" /></Button></div></div>
    <div className="grid grid-cols-7 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)]">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day} className="p-2 text-center text-[10px] font-semibold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{day}</div>)}</div>
    <div className="grid grid-cols-7">{days.map((day) => {
      const dayEvents = eventsByDay.get(isoDay(day)) || [];
      const outside = day.getMonth() !== month.getMonth();
      return <div key={isoDay(day)} className={`min-h-24 border-b border-r border-[hsl(var(--border))] p-2 ${outside ? 'bg-[hsl(var(--muted)/.18)]' : 'bg-[hsl(var(--card))]'}`}><p className={`text-xs font-semibold ${outside ? 'text-[hsl(var(--muted-foreground)/.5)]' : ''}`}>{day.getDate()}</p><div className="mt-1 space-y-1">{dayEvents.slice(0, 3).map((event) => <button type="button" key={event.id} onClick={() => onSelect(event)} className="block w-full truncate rounded-md bg-[hsl(var(--primary)/.12)] px-1.5 py-1 text-left text-[10px] font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.22)]" title={event.title} data-testid={`calendar-event-${event.id}`}>{event.title}</button>)}{dayEvents.length > 3 && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">+{dayEvents.length - 3} more</p>}</div></div>;
    })}</div>
  </Panel>;
}

function EventDetails({ event, response, reminder, onResponse, onReminder, onClose }: { event: EventRecord; response?: RSVP; reminder: boolean; onResponse: (response?: RSVP) => void; onReminder: () => void; onClose: () => void }) {
  const attendees = event.attendees || [];
  const attendeeNames = attendees.length ? attendees : response ? [{ name: 'You', response }] : [];
  const addToCalendar = () => {
    const start = dateObject(event.date);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const stamp = (value: Date) => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const escape = (value: string) => value.replace(/[\\;,]/g, (match) => `\\${match}`).replace(/\n/g, '\\n');
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//EMMECTY School//Events//EN\nBEGIN:VEVENT\nUID:${event.id}@emmecty.school\nDTSTAMP:${stamp(new Date())}\nDTSTART:${stamp(start)}\nDTEND:${stamp(end)}\nSUMMARY:${escape(event.title)}\nLOCATION:${escape(event.location)}\nDESCRIPTION:${escape(event.description || '')}\nEND:VEVENT\nEND:VCALENDAR`;
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${event.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'school-event'}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return <Panel className="relative overflow-hidden p-5" testId="panel-event-details">
    <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Close event details" data-testid="button-close-event-details"><X className="size-4" /></button>
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--secondary))] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--primary))]"><CalendarDays className="size-3" /> {event.type}</span>
    <h2 className="mt-4 pr-8 font-display text-2xl">{event.title}</h2>
    <div className="mt-4 space-y-3 text-sm"><p className="flex items-start gap-2"><Clock3 className="mt-0.5 size-4 shrink-0 text-[hsl(var(--primary))]" /><span>{formatEventDate(event.date)}</span></p><p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-[hsl(var(--primary))]" /><span className="break-words">{event.location}</span></p>{event.host && <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[hsl(var(--primary))]" /><span><span className="font-semibold">{event.host}</span>{event.hostRole ? ` · ${event.hostRole}` : ''}{event.hostContact ? <span className="block text-xs text-[hsl(var(--muted-foreground))]">{event.hostContact}</span> : null}</span></p>}</div>
    {event.description && <p className="mt-5 border-t border-[hsl(var(--border))] pt-5 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{event.description}</p>}
    <div className="mt-5 rounded-2xl bg-[hsl(var(--muted)/.55)] p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Attendees</p><span className="text-xs text-[hsl(var(--muted-foreground))]">{attendees.length}{event.attendeeLimit ? ` / ${event.attendeeLimit}` : ''}</span></div>{attendeeNames.length ? <div className="mt-3 flex flex-wrap gap-2">{attendeeNames.map((attendee, index) => <span key={`${attendee.name}-${index}`} className="rounded-full bg-[hsl(var(--card))] px-2.5 py-1 text-xs">{attendee.name} · {attendee.response}</span>)}</div> : <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">No attendee responses yet. Be the first to respond.</p>}</div>
    <div className="mt-5 flex flex-wrap gap-2"><Button onClick={() => onResponse(response === 'attending' ? undefined : 'attending')} variant={response === 'attending' ? 'primary' : 'secondary'} testId="button-rsvp-attending"><Check className="size-4" />{response === 'attending' ? 'Attending' : 'Attend'}</Button><Button onClick={() => onResponse(response === 'interested' ? undefined : 'interested')} variant={response === 'interested' ? 'primary' : 'secondary'} testId="button-rsvp-interested"><Sparkles className="size-4" />{response === 'interested' ? 'Interested' : 'Interested'}</Button><Button onClick={onReminder} variant="secondary" testId="button-event-reminder"><Clock3 className="size-4" />{reminder ? 'Reminder set' : 'Set reminder'}</Button><Button onClick={addToCalendar} variant="secondary" testId="button-add-to-calendar"><CalendarPlus className="size-4" />Add to calendar</Button></div>
  </Panel>;
}

export function EventsPage() {
  const client = useQueryClient();
  const session = useGetCurrentUser();
  const operations = useGetOperations();
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [rsvpFilter, setRsvpFilter] = useState('all');
  const [sort, setSort] = useState<'soonest' | 'latest'>('soonest');
  const [selectedId, setSelectedId] = useState<string>();
  const [month, setMonth] = useState(() => new Date());
  const [responses, setResponses] = useState<Record<string, RSVP>>({});
  const [reminders, setReminders] = useState<Record<string, boolean>>({});
  const events = useMemo(() => (operations.data?.modules.events || []).map(toRecord), [operations.data?.modules.events]);
  const canCreate = session.data?.user.role === 'administrator' || session.data?.user.role === 'super_admin' || session.data?.user.role === 'secretary';
  useEffect(() => {
    if (!session.data?.user.id) return;
    try {
      setResponses(JSON.parse(localStorage.getItem(responseKey(session.data.user.id)) || '{}'));
      setReminders(JSON.parse(localStorage.getItem(calendarKey(session.data.user.id)) || '{}'));
    } catch {
      setResponses({});
      setReminders({});
    }
  }, [session.data?.user.id]);
  useEffect(() => {
    if (!session.data?.user.id) return;
    localStorage.setItem(responseKey(session.data.user.id), JSON.stringify(responses));
    localStorage.setItem(calendarKey(session.data.user.id), JSON.stringify(reminders));
  }, [responses, reminders, session.data?.user.id]);
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const now = Date.now();
    Object.entries(reminders).forEach(([id, enabled]) => {
      const event = events.find((item) => item.id === id);
      if (enabled && event && dateObject(event.date).getTime() - now < 30 * 60 * 1000 && dateObject(event.date).getTime() > now) {
        new Notification(`Upcoming school event: ${event.title}`, { body: `${formatEventDate(event.date)} · ${event.location}` });
      }
    });
  }, [events, reminders]);
  const categories = useMemo(() => ['all', ...Array.from(new Set(events.map((event) => event.type))).sort()], [events]);
  const filteredEvents = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(now.getDate() + 30);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return events.filter((event) => {
      const haystack = `${event.title} ${event.type} ${event.location} ${event.description || ''} ${event.host || ''}`.toLowerCase();
      const date = dateObject(event.date);
      const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
      const matchesCategory = category === 'all' || event.type === category;
      const matchesDate = dateRange === 'all' || (dateRange === 'next-30' && date >= now && date <= end) || (dateRange === 'this-month' && date >= monthStart && date <= monthEnd) || (dateRange === 'past' && date < now);
      const response = responses[event.id];
      const matchesRSVP = rsvpFilter === 'all' || (rsvpFilter === 'unresponded' ? !response : response === rsvpFilter);
      return matchesSearch && matchesCategory && matchesDate && matchesRSVP;
    }).sort((a, b) => (sort === 'soonest' ? dateObject(a.date).getTime() - dateObject(b.date).getTime() : dateObject(b.date).getTime() - dateObject(a.date).getTime()));
  }, [category, dateRange, events, responses, rsvpFilter, search, sort]);
  const selectedEvent = filteredEvents.find((event) => event.id === selectedId) || events.find((event) => event.id === selectedId);
  const setResponse = (event: EventRecord, response?: RSVP) => {
    setResponses((current) => {
      const next = { ...current };
      if (response) next[event.id] = response;
      else delete next[event.id];
      return next;
    });
    trackEvent('event_rsvp_updated', { event_id: event.id, response: response || 'none' });
  };
  const setReminder = async (event: EventRecord) => {
    if (!reminders[event.id] && typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission();
    setReminders((current) => ({ ...current, [event.id]: !current[event.id] }));
  };
  return <AppShell>
    <PageHeader eyebrow="School calendar" title="Events" description="Plan school life in one place: meetings, gatherings, deadlines, public holidays, and learning activities." action={<div className="flex flex-wrap gap-2">{canCreate && <Button onClick={() => setShowCreate((value) => !value)} testId="button-open-create-event"><Plus className="size-4" />{showCreate ? 'Close form' : 'Create event'}</Button>}<Button variant="secondary" onClick={() => { void operations.refetch(); void client.invalidateQueries({ queryKey: getGetOperationsQueryKey() }); }} testId="button-refresh-events"><RefreshCcw className="size-4" /> Refresh</Button></div>} />
    {showCreate && canCreate && <CreateEventForm onDone={() => setShowCreate(false)} />}
     <Panel className="p-4" testId="panel-event-filters"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_repeat(4,minmax(145px,1fr))_auto]"><label className="relative min-w-0"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-[hsl(var(--muted-foreground))]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events, hosts, locations..." className={`${inputClass} pl-9`} aria-label="Search events" data-testid="input-search-events" /></label><div className="flex min-w-0 items-center gap-2 text-xs font-semibold"><Filter className="size-4 shrink-0 text-[hsl(var(--primary))]" /><SearchableSelect value={category} onValueChange={setCategory} options={categories.map((item) => ({ value: item, label: item === 'all' ? 'All categories' : item }))} placeholder="All categories" searchPlaceholder="Search event categories…" testId="select-event-category" /></div><select value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRange)} className={`${inputClass} min-w-0`} aria-label="Filter events by date" data-testid="select-event-date-range"><option value="all">All dates</option><option value="next-30">Next 30 days</option><option value="this-month">This month</option><option value="past">Past events</option></select><select value={rsvpFilter} onChange={(event) => setRsvpFilter(event.target.value)} className={`${inputClass} min-w-0`} aria-label="Filter events by RSVP" data-testid="select-event-rsvp-filter"><option value="all">All RSVP status</option><option value="attending">Attending</option><option value="interested">Interested</option><option value="unresponded">Not responded</option></select><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className={`${inputClass} min-w-0`} aria-label="Sort events" data-testid="select-event-sort"><option value="soonest">Soonest first</option><option value="latest">Latest first</option></select><div className="flex min-w-0 justify-end rounded-xl bg-[hsl(var(--muted))] p-1"><button type="button" onClick={() => setView('calendar')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === 'calendar' ? 'bg-[hsl(var(--card))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid="button-events-calendar-view"><CalendarDays className="mr-1 inline size-3.5" />Calendar</button><button type="button" onClick={() => setView('list')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === 'list' ? 'bg-[hsl(var(--card))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid="button-events-list-view">Agenda</button></div></div><p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">{filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'} match your filters. Select an event to view details, RSVP, or set a reminder.</p></Panel>
    {operations.isError ? <Panel><ErrorState onRetry={() => operations.refetch()} /></Panel> : view === 'calendar' ? <CalendarGrid events={filteredEvents} month={month} onMonthChange={setMonth} onSelect={(event) => setSelectedId(event.id)} /> : <Panel className="overflow-hidden" testId="panel-event-agenda">{filteredEvents.length ? <div className="divide-y divide-[hsl(var(--border))]">{filteredEvents.map((event) => <button type="button" key={event.id} onClick={() => setSelectedId(event.id)} className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-[hsl(var(--muted)/.4)]" data-testid={`agenda-event-${event.id}`}><span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><span className="text-[10px] font-bold uppercase">{dateObject(event.date).toLocaleDateString('en-UG', { month: 'short' })}</span><span className="font-display text-xl">{dateObject(event.date).getDate()}</span></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{event.title}</span><span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] font-semibold uppercase">{event.type}</span></span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{formatEventDate(event.date)} · {event.location}</span><span className="mt-2 block text-sm text-[hsl(var(--muted-foreground))]">{event.description || 'Open the event for full details and RSVP options.'}</span></span><ChevronRight className="mt-2 size-4 shrink-0 text-[hsl(var(--muted-foreground))]" /></button>)}</div> : <EmptyState icon={CalendarDays} title="No events match these filters" description="Try another category or create the first school calendar entry." action={canCreate ? <Button onClick={() => setShowCreate(true)}><Plus className="size-4" /> Create event</Button> : undefined} />}</Panel>}
    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><Panel className="p-5" testId="panel-event-guidance"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Megaphone className="size-4" /></span><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Uganda school calendar desk</p><h2 className="mt-1 font-display text-xl">Plan with official guidance</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Use the Ministry of Education and Sports calendar and reopening notices when planning school events, family meetings, and term activities.</p><a href="https://www.education.go.ug/school-calendars" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))]" data-testid="link-moes-calendar">Open MoES school calendars <ExternalLink className="size-3.5" /></a></div></div></Panel><Panel className="p-5" testId="panel-event-reminder-guidance"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><ShieldCheck className="size-4" /></span><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Safe participation</p><h2 className="mt-1 font-display text-xl">Every child belongs</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Make events accessible, respectful, and safe. School staff should follow the Children Act and report suspected abuse or rights violations to the responsible child-welfare authority.</p><a href="https://ulii.org/akn/ug/act/statute/1996/6/eng@2023-12-31" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))]" data-testid="link-children-act">Read Uganda Children Act <ExternalLink className="size-3.5" /></a></div></div></Panel></div>
    {selectedEvent && <EventDetails event={selectedEvent} response={responses[selectedEvent.id]} reminder={!!reminders[selectedEvent.id]} onResponse={(response) => setResponse(selectedEvent, response)} onReminder={() => void setReminder(selectedEvent)} onClose={() => setSelectedId(undefined)} />}
  </AppShell>;
}