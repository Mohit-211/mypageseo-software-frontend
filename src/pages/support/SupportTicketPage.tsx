import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Clock, LoaderCircle, MessagesSquare, Send } from "lucide-react";
import logoMarkUrl from "@/assets/logo-mark.png";
import { closeTicket, getTicket, isApiError, replyToTicket, type TicketMessage } from "@/api";
import { PageHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { InitialsAvatar } from "@/components/team/initials-avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRequiredParams } from "@/hooks/use-required-params";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { retryUnlessClientError, SUPPORT_KEY, TICKET_CATEGORY_LABEL, TICKET_STATUS } from "@/lib/support/tickets";

/** One ticket's thread. Team replies show as "MyPageSEO team"; replying reopens a resolved ticket. */
function SupportTicketPage() {
  const { ticketId } = useRequiredParams("ticketId");
  const queryClient = useQueryClient();
  const ticket = useQuery({ queryKey: [...SUPPORT_KEY, ticketId], queryFn: ({ signal }) => getTicket(ticketId, signal), retry: retryUnlessClientError });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"reply" | "close" | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: SUPPORT_KEY });

  const backLink = (
    <Link
      to="/support"
      className="inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft aria-hidden className="size-3.5" /> All tickets
    </Link>
  );

  if (ticket.isPending) return <PageSkeleton metrics={0} rows={3} columns={1} />;
  if (ticket.isError) {
    return isApiError(ticket.error) && ticket.error.status === 404 ? (
      <EmptyState
        variant="no-results"
        icon={MessagesSquare}
        title="Ticket not found"
        description="It may belong to another organization, or the link is out of date."
        action={
          <Button asChild variant="outline">
            <Link to="/support">
              <ArrowLeft aria-hidden /> All tickets
            </Link>
          </Button>
        }
      />
    ) : (
      <ErrorState title="The ticket couldn't be loaded" description="Check your connection and try again." onRetry={() => void ticket.refetch()} />
    );
  }
  const data = ticket.data;
  const closed = data.status === "closed";
  const status = TICKET_STATUS[data.status];

  const reply = () => {
    if (busy || !message.trim()) return;
    setBusy("reply");
    void replyToTicket(ticketId, message.trim())
      .then(() => {
        setMessage("");
        toast.success("Reply sent", { description: "We'll answer here and by email." });
        refresh();
      })
      .catch((err: unknown) => toast.error(isApiError(err) && err.reason === "ticket_closed" ? "This ticket is closed. Open a new one." : "The reply couldn't be sent. Try again."))
      .finally(() => setBusy(null));
  };

  return (
    <>
      <PageHeader
        icon={MessagesSquare}
        tone="help"
        eyebrow={backLink}
        title={data.subject}
        description={`${data.number} · opened ${formatDateTime(data.created_at)}${data.category ? ` · ${TICKET_CATEGORY_LABEL[data.category] ?? data.category}` : ""}`}
        meta={
          <StatusBadge tone={status.tone} dot>
            {status.label}
          </StatusBadge>
        }
        actions={
          !closed ? (
            <Button variant="outline" disabled={busy !== null} aria-busy={busy === "close" || undefined} onClick={() => setConfirmClose(true)}>
              {busy === "close" ? <LoaderCircle aria-hidden className="animate-spin" /> : <CheckCircle2 aria-hidden />} Close ticket
            </Button>
          ) : undefined
        }
      />

      {data.status === "waiting_on_customer" ? (
        <p role="status" className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning-surface px-4 py-3 text-sm text-foreground">
          <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          The team is waiting for your reply.
        </p>
      ) : data.status === "resolved" ? (
        <p role="status" className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success-surface px-4 py-3 text-sm text-foreground">
          <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
          The team marked this as resolved. Reply if you still need help, and it reopens.
        </p>
      ) : null}

      <section aria-label="Conversation" className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
        {(data.thread ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <ol className="space-y-5">
            {(data.thread ?? []).map((entry) => (
              <MessageBubble key={entry.id} entry={entry} />
            ))}
          </ol>
        )}
      </section>

      {closed ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">This ticket is closed, so it can't take new replies.</p>
          <Button asChild size="sm">
            <Link to="/support">Open a new ticket</Link>
          </Button>
        </div>
      ) : (
        <form
          className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5"
          onSubmit={(event) => {
            event.preventDefault();
            reply();
          }}
        >
          <Label htmlFor="ticket-reply" className="text-sm font-semibold text-foreground">
            Your reply
          </Label>
          <Textarea
            id="ticket-reply"
            rows={4}
            className="mt-2"
            placeholder="Write a reply…"
            value={message}
            disabled={busy === "reply"}
            aria-describedby="ticket-reply-hint"
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              // ⌘/Ctrl + Enter sends, like most messaging tools.
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                reply();
              }
            }}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p id="ticket-reply-hint" className="text-xs text-muted-foreground">
              Press ⌘ Enter (Ctrl Enter on Windows) to send.
            </p>
            <Button type="submit" disabled={busy !== null || !message.trim()} aria-busy={busy === "reply" || undefined}>
              {busy === "reply" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send aria-hidden />} {busy === "reply" ? "Sending…" : "Send reply"}
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Close this ticket?"
        description="Closed tickets can't take replies. You can open a new ticket any time."
        confirmLabel="Close ticket"
        cancelLabel="Keep it open"
        destructive={false}
        onConfirm={() => {
          setConfirmClose(false);
          setBusy("close");
          void closeTicket(ticketId)
            .then(() => {
              toast.success("Ticket closed");
              refresh();
            })
            .catch(() => toast.error("The ticket couldn't be closed. Try again."))
            .finally(() => setBusy(null));
        }}
      />
    </>
  );
}

/** One message: the team on the left with the MyPageSEO mark, you on the right. */
function MessageBubble({ entry }: { entry: TicketMessage }) {
  const team = entry.author.kind === "team";
  return (
    <li className={cn("flex items-end gap-2.5", team ? "justify-start" : "flex-row-reverse")}>
      {team ? (
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-card ring-1 ring-border-strong">
          <img src={logoMarkUrl} alt="" className="size-5 object-contain" />
        </span>
      ) : (
        <InitialsAvatar name={entry.author.name} />
      )}
      <div className={cn("min-w-0 max-w-[85%] sm:max-w-[70%]", team ? "" : "text-right")}>
        <p className="mb-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{team ? "MyPageSEO team" : entry.author.name}</span> · {formatDateTime(entry.created_at)}
        </p>
        <div
          className={cn(
            "whitespace-pre-line rounded-2xl px-4 py-2.5 text-left text-sm leading-6 text-foreground",
            team ? "rounded-bl-md border border-primary/20 bg-brand-tint" : "rounded-br-md border border-border bg-surface-strong",
          )}
        >
          {entry.body}
        </div>
      </div>
    </li>
  );
}

export default SupportTicketPage;
