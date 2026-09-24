import { useEffect, useRef, useState, type FormEvent } from "react";
import { getGetSettingsQueryKey, getListMessageRecipientsQueryKey, useGetCurrentUser, useGetSettings, useListMessageRecipients, useSendDirectMessage } from "@workspace/api-client-react";
import { ArrowLeft, Search, Send, Users } from "lucide-react";
import { Link } from "wouter";
import { AppShell, Button, PageHeader, Panel } from "@/components/school-shell";

type Recipient = { id: string; name: string; detail: string; canSend?: boolean };
type SendSummary = {
  status: "accepted" | "partial" | "failed" | "disabled" | "duplicate";
  recipientCount: number;
  acceptedCount: number;
  failedCount: number;
  duplicateCount: number;
};

function RecipientSection({
  title,
  description,
  recipients,
  selectedIds,
  onToggle,
  disabled,
  searchLabel,
  testId,
}: {
  title: string;
  description: string;
  recipients: Recipient[];
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  disabled: boolean;
  searchLabel: string;
  testId: string;
}) {
  const [search, setSearch] = useState("");
  const filteredRecipients = recipients.filter((recipient) =>
    `${recipient.name} ${recipient.detail}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <Panel className="overflow-hidden" testId={testId}>
      <div className="border-b border-[hsl(var(--border))] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{description}</p>
          </div>
          <span className="shrink-0 rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs font-semibold text-[hsl(var(--foreground))]">
            {selectedIds.size} selected
          </span>
        </div>
        <label className="mt-4 flex min-h-10 items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3">
          <Search className="size-4 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${title.toLowerCase()}`}
            aria-label={searchLabel}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
          />
        </label>
      </div>
      <div className="max-h-80 divide-y divide-[hsl(var(--border))] overflow-y-auto">
        {filteredRecipients.length ? filteredRecipients.map((recipient) => (
          <label
            key={recipient.id}
            htmlFor={`${testId}-${recipient.id}`}
            className={`flex items-start gap-3 p-4 transition-colors ${recipient.canSend === false ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-[hsl(var(--muted)/.45)]"}`}
          >
            <input
              id={`${testId}-${recipient.id}`}
              type="checkbox"
              disabled={disabled || recipient.canSend === false}
              checked={selectedIds.has(recipient.id)}
              onChange={() => onToggle(recipient.id)}
              className="mt-1 size-4 shrink-0 accent-[hsl(var(--primary))] disabled:cursor-not-allowed"
              data-testid={`checkbox-${testId}-${recipient.id}`}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{recipient.name}</span>
              <span className="mt-0.5 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">{recipient.detail}</span>
            </span>
          </label>
        )) : (
          <p className="p-5 text-sm text-[hsl(var(--muted-foreground))]">
            {recipients.length ? "No contacts match that search." : "No contacts with an available phone number."}
          </p>
        )}
      </div>
    </Panel>
  );
}

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The message could not be sent.";
}

export default function MessagesPage() {
  const sessionQuery = useGetCurrentUser();
  const role = sessionQuery.data?.user.role;
  const isAdministrator = role === "administrator" || role === "super_admin";
  const settingsQuery = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey(), refetchOnMount: "always" },
  });
  const recipientsQuery = useListMessageRecipients({
    query: { queryKey: getListMessageRecipientsQueryKey(), enabled: isAdministrator, refetchOnMount: "always" },
  });
  const sendMutation = useSendDirectMessage();
  const [teacherIds, setTeacherIds] = useState<Set<string>>(() => new Set());
  const [parentIds, setParentIds] = useState<Set<string>>(() => new Set());
  const [pupilIds, setPupilIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("");
  const [sendSummary, setSendSummary] = useState<SendSummary>();
  const requestRef = useRef<{ fingerprint: string; id: string } | undefined>(undefined);
  useEffect(() => {
    const currentRecipients = recipientsQuery.data;
    if (!currentRecipients) return;
    const availableTeacherIds = new Set(currentRecipients.teachers.map((recipient) => recipient.id));
    const availableParentIds = new Set(currentRecipients.parents.map((recipient) => recipient.id));
    const availablePupilIds = new Set(currentRecipients.pupils.filter((pupil) => pupil.canSend).map((pupil) => pupil.id));
    setTeacherIds((current) => {
      const next = new Set([...current].filter((id) => availableTeacherIds.has(id)));
      return next.size === current.size ? current : next;
    });
    setParentIds((current) => {
      const next = new Set([...current].filter((id) => availableParentIds.has(id)));
      return next.size === current.size ? current : next;
    });
    setPupilIds((current) => {
      const next = new Set([...current].filter((id) => availablePupilIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [recipientsQuery.data]);

  const schoolName = settingsQuery.data?.schoolName?.replace(/\s+/gu, " ").trim() || "";
  const selectedRecipientCount = teacherIds.size + parentIds.size + pupilIds.size;
  const recipients = recipientsQuery.data;
  const toggleId = (setter: (update: (current: Set<string>) => Set<string>) => void, id: string) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdministrator || !schoolName || !message.trim() || !selectedRecipientCount) return;
    setSendSummary(undefined);
    const sortedTeacherIds = [...teacherIds].sort();
    const sortedParentIds = [...parentIds].sort();
    const sortedPupilIds = [...pupilIds].sort();
    const fingerprint = JSON.stringify({ teacherIds: sortedTeacherIds, parentIds: sortedParentIds, pupilIds: sortedPupilIds, message: message.trim() });
    const requestId = requestRef.current?.fingerprint === fingerprint
      ? requestRef.current.id
      : window.crypto.randomUUID();
    requestRef.current = { fingerprint, id: requestId };

    sendMutation.mutate({
      data: {
        requestId,
        teacherIds: sortedTeacherIds,
        parentIds: sortedParentIds,
        pupilIds: sortedPupilIds,
        message: message.trim(),
      },
    }, {
      onSuccess: (result) => {
        setSendSummary(result);
        if (result.status === "accepted") requestRef.current = undefined;
      },
    });
  };

  if (sessionQuery.isLoading) {
    return <AppShell><Panel className="p-6"><p className="text-sm text-[hsl(var(--muted-foreground))]">Loading account…</p></Panel></AppShell>;
  }

  if (!isAdministrator) {
    return (
      <AppShell>
        <PageHeader eyebrow="Communication" title="Messages" description="Direct school messages are available to administrators." />
        <Panel className="p-6" testId="panel-messages-forbidden">
          <p className="text-sm font-semibold">Administrator access required</p>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">You do not have permission to send direct school messages.</p>
        </Panel>
      </AppShell>
    );
  }

  const preview = schoolName && message.trim()
    ? `${schoolName}: ${message.trim().replace(/\s+/gu, " ")}`
    : schoolName ? `${schoolName}: Your message will appear here.` : "Set the school name in Settings to enable branded messages.";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Communication · Administrator"
        title="Send a message"
        description="Choose specific teachers, pupils, or parents and guardians. Messages to pupils go to their guardian contact; phone numbers are never shown here."
        action={
          <Link
            href="/dashboard"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
            data-testid="link-messages-dashboard"
          >
            <ArrowLeft className="size-4" /> Dashboard
          </Link>
        }
      />

      {recipientsQuery.isLoading ? (
        <Panel className="p-6" testId="panel-message-recipients-loading">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading contacts with available phone numbers…</p>
        </Panel>
      ) : recipientsQuery.isError ? (
        <Panel className="p-6" testId="panel-message-recipients-error">
          <p className="text-sm font-semibold">Contacts could not be loaded</p>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Refresh the list before sending so the message goes only to current contacts.</p>
          <Button className="mt-4" variant="secondary" onClick={() => void recipientsQuery.refetch()} testId="button-retry-message-recipients">
            Refresh contacts
          </Button>
        </Panel>
      ) : (
        <form className="space-y-6" onSubmit={submitMessage}>
          <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            <RecipientSection
              title="Teachers"
              description="Active teacher accounts with a usable phone number."
              recipients={recipients?.teachers ?? []}
              selectedIds={teacherIds}
              onToggle={(id) => {
                setSendSummary(undefined);
                sendMutation.reset();
                toggleId(setTeacherIds, id);
              }}
              disabled={sendMutation.isPending}
              searchLabel="Search teachers"
              testId="message-teachers"
            />
            <RecipientSection
              title="Pupils"
              description="All active and inactive pupils, including school-sponsored pupils. Selecting a pupil messages their guardian."
              recipients={recipients?.pupils ?? []}
              selectedIds={pupilIds}
              onToggle={(id) => {
                setSendSummary(undefined);
                sendMutation.reset();
                toggleId(setPupilIds, id);
              }}
              disabled={sendMutation.isPending}
              searchLabel="Search pupils and guardians"
              testId="message-pupils"
            />
            <RecipientSection
              title="Parents and guardians"
              description="Guardian contacts linked to active or inactive pupils; shared family numbers appear once."
              recipients={recipients?.parents ?? []}
              selectedIds={parentIds}
              onToggle={(id) => {
                setSendSummary(undefined);
                sendMutation.reset();
                toggleId(setParentIds, id);
              }}
              disabled={sendMutation.isPending}
              searchLabel="Search parents and guardians"
              testId="message-parents"
            />
          </div>

          <Panel className="p-5 md:p-6" testId="panel-message-composer">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">
                <Users className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-xl">Message content</h2>
                <p className="mt-1 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  {selectedRecipientCount} selected contact{selectedRecipientCount === 1 ? "" : "s"}. Shared phone numbers receive one SMS.
                </p>
              </div>
            </div>

            <label htmlFor="school-direct-message" className="mt-5 block text-sm font-semibold">Your message</label>
            <textarea
              id="school-direct-message"
              value={message}
              onChange={(event) => {
                setSendSummary(undefined);
                sendMutation.reset();
                setMessage(event.target.value);
              }}
              disabled={sendMutation.isPending}
              rows={5}
              maxLength={1000}
              placeholder="Write a brief school update…"
              className="mt-2 min-h-32 w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm leading-6 outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.18)]"
              data-testid="textarea-direct-message"
            />
            <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              The school name is added at the start. Messages must fit one SMS segment: 160 GSM-7 units or 70 Unicode code units.
            </p>

            <div className="mt-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.4)] p-4">
              <p className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">SMS preview</p>
              <p className="mt-2 break-words text-sm leading-6">{preview}</p>
            </div>

            {sendMutation.isError && (
              <p className="mt-4 rounded-xl border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.08)] p-3 text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="text-send-message-error">
                {mutationErrorMessage(sendMutation.error)}
              </p>
            )}

            {sendSummary && (
              <div
                className={`mt-4 rounded-xl border p-4 text-sm ${
                  sendSummary.status === "accepted"
                    ? "border-[hsl(var(--chart-2)/.35)] bg-[hsl(var(--chart-2)/.08)]"
                    : "border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)]"
                }`}
                role="status"
                data-testid="panel-direct-message-result"
              >
                {sendSummary.status === "accepted" && (
                  <p>Yoola accepted the SMS for {sendSummary.acceptedCount} unique phone number{sendSummary.acceptedCount === 1 ? "" : "s"}.</p>
                )}
                {sendSummary.status === "partial" && (
                  <p>Yoola accepted {sendSummary.acceptedCount} of {sendSummary.recipientCount} unique phone numbers. {sendSummary.failedCount} failed and {sendSummary.duplicateCount} were already processed.</p>
                )}
                {sendSummary.status === "failed" && (
                  <p>Yoola did not confirm this message for delivery. Automatic retries are suppressed; check the provider status before composing another send.</p>
                )}
                {sendSummary.status === "disabled" && (
                  <p>SMS is not configured, so no message was sent. Configure Yoola before sending.</p>
                )}
                {sendSummary.status === "duplicate" && (
                  <p>This send request was already processed. No duplicate SMS was sent to these contacts.</p>
                )}
                {sendSummary.status !== "accepted" && sendSummary.failedCount > 0 && (
                  <p className="mt-2">Unconfirmed: {sendSummary.failedCount}. Already processed: {sendSummary.duplicateCount}.</p>
                )}
                <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Provider acceptance does not confirm that a handset received the SMS.</p>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Only the contacts you selected will receive this message.</p>
              <Button
                type="submit"
                disabled={!selectedRecipientCount || !message.trim() || !schoolName || sendMutation.isPending}
                testId="button-send-direct-message"
              >
                <Send className="size-4" aria-hidden="true" />
                {sendMutation.isPending ? "Sending…" : "Send message"}
              </Button>
            </div>
          </Panel>
        </form>
      )}
    </AppShell>
  );
}