import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { getListSubjectsQueryKey, getListUsersQueryKey, type SubjectInput, useCreateSubject, useDeleteSubject, useGetCurrentUser, useGetOperations, useListSubjects, useListUsers, useUpdateSubject } from '@workspace/api-client-react';
import { AppShell, Button, EmptyState, ErrorState, PageHeader, Panel, Skeleton } from '@/components/school-shell';

const inputClass = 'focus-ring h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm outline-none';
const emptyForm = (): SubjectInput => ({ name: '', className: '', classId: '', stream: '', teacherId: '', teacherName: '' });

export function SubjectsPage() {
  const client = useQueryClient();
  const session = useGetCurrentUser();
  const operations = useGetOperations();
  const subjects = useListSubjects();
  const isAdmin = session.data?.user.role === 'administrator' || session.data?.user.role === 'super_admin';
  const users = useListUsers({ query: { enabled: isAdmin, queryKey: getListUsersQueryKey() } });
  const create = useCreateSubject();
  const update = useUpdateSubject();
  const remove = useDeleteSubject();
  const classes = operations.data?.modules.classes || [];
  const teachers = isAdmin ? (users.data || []).filter((user) => user.role === 'teacher') : session.data?.user.role === 'teacher' ? [session.data.user] : [];
  const [form, setForm] = useState<SubjectInput>(emptyForm());
  const [editingId, setEditingId] = useState<string>();
  const [notice, setNotice] = useState('');
  const selectedClass = classes.find((item) => item.id === form.classId);
  const refresh = () => client.invalidateQueries({ queryKey: getListSubjectsQueryKey() });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setNotice('');
    const data = { ...form, className: selectedClass?.name || form.className, stream: selectedClass?.stream || form.stream, teacherName: teachers.find((teacher) => teacher.id === form.teacherId)?.name || form.teacherName };
    if (editingId) update.mutate({ subjectId: editingId, data }, { onSuccess: () => { refresh(); setEditingId(undefined); setForm(emptyForm()); setNotice('Subject updated.'); }, onError: () => setNotice('The subject could not be updated.') });
    else create.mutate({ data }, { onSuccess: () => { refresh(); setForm(emptyForm()); setNotice('Subject created.'); }, onError: () => setNotice('The subject could not be created. Check the class and duplicate assignments.') });
  };
  const editSubject = (subject: NonNullable<typeof subjects.data>[number]) => { setEditingId(subject.id); setForm({ name: subject.name, className: subject.className, classId: subject.classId || classes.find((item) => item.name === subject.className && item.stream === subject.stream)?.id || '', stream: subject.stream || '', teacherId: subject.teacherId || '', teacherName: subject.teacherName }); };
  const deleteSubject = (id: string) => { if (!window.confirm('Delete this subject assignment?')) return; remove.mutate({ subjectId: id }, { onSuccess: refresh, onError: () => setNotice('You do not have permission to delete this subject.') }); };
  if (session.isLoading || operations.isLoading) return <AppShell><Skeleton className="h-40" /></AppShell>;
  if (!session.data || !['administrator', 'super_admin', 'teacher'].includes(session.data.user.role)) return <AppShell><ErrorState message="Subjects are available to administrators and teachers." /></AppShell>;
  return <AppShell><PageHeader eyebrow="Academics" title="Subjects" description="Keep subject assignments connected to a real class, stream, and teacher." action={<Button onClick={() => { setEditingId(undefined); setForm(emptyForm()); }} testId="button-new-subject"><Plus className="size-4" /> New subject</Button>} />
    {notice && <div className="mb-5 rounded-xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.06)] px-4 py-3 text-sm" role="status">{notice}</div>}
    <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
      <Panel className="p-5"><div className="mb-4 flex items-center gap-3"><BookOpen className="size-5 text-[hsl(var(--primary))]" /><div><h2 className="font-display text-xl">{editingId ? 'Edit subject' : 'Add subject'}</h2><p className="text-sm text-[hsl(var(--muted-foreground))]">Duplicate subject/class assignments are rejected.</p></div></div><form onSubmit={submit} className="space-y-3"><input className={inputClass} required placeholder="Subject name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><select className={inputClass} required value={form.classId} onChange={(e) => { const item = classes.find((row) => row.id === e.target.value); setForm({ ...form, classId: e.target.value, className: item?.name || '', stream: item?.stream || '' }); }}><option value="">Choose class and stream</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.stream ? ` · ${item.stream}` : ''}</option>)}</select><select className={inputClass} value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value, teacherName: teachers.find((teacher) => teacher.id === e.target.value)?.name || '' })}><option value="">Unassigned teacher</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select><div className="flex gap-2"><Button type="submit" disabled={create.isPending || update.isPending || !form.classId} testId="button-save-subject">{create.isPending || update.isPending ? 'Saving…' : editingId ? 'Save subject' : 'Create subject'}</Button>{editingId && <Button onClick={() => { setEditingId(undefined); setForm(emptyForm()); }} variant="secondary" testId="button-cancel-subject">Cancel</Button>}</div></form></Panel>
      <Panel className="overflow-hidden"><div className="border-b border-[hsl(var(--border))] px-5 py-4"><h2 className="font-display text-xl">Subject register</h2><p className="text-sm text-[hsl(var(--muted-foreground))]">{subjects.data?.length || 0} visible assignments</p></div>{subjects.isError ? <ErrorState onRetry={() => subjects.refetch()} /> : !subjects.data?.length ? <EmptyState icon={BookOpen} title="No subjects registered" description="Add the first subject for a class and stream." /> : <div className="divide-y divide-[hsl(var(--border))]">{subjects.data.map((subject) => <div key={subject.id} className="flex flex-wrap items-center gap-3 px-5 py-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{subject.name}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{subject.className}{subject.stream ? ` · ${subject.stream}` : ''} · {subject.teacherName}</p></div><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">{subject.status}</span><Button onClick={() => editSubject(subject)} variant="quiet" testId={`button-edit-subject-${subject.id}`}><Pencil className="size-4" /> Edit</Button><Button onClick={() => deleteSubject(subject.id)} variant="danger" testId={`button-delete-subject-${subject.id}`}><Trash2 className="size-4" /></Button></div>)}</div>}</Panel>
    </div>
  </AppShell>;
}