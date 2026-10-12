import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, LoaderCircle, Send } from "lucide-react";
import { closeTicket, getTicket, isApiError, replyToTicket } from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRequiredParams } from "@/hooks/use-required-params";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { SUPPORT_KEY, TICKET_STATUS } from "@/lib/support/tickets";

/** One ticket's thread. Team replies show as "MyPageSEO team"; replying reopens a resolved ticket. */
function SupportTicketPage() {
  const { ticketId } = useRequiredParams("ticketId");
  const queryClient = useQueryClient();
  const ticket = useQuery({ queryKey: [...SUPPORT_KEY, ticketId], queryFn: ({ signal }) => getTicket(ticketId, signal) });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"reply" | "close" | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: SUPPORT_KEY });

  if (ticket.isPending) return <AppShell><PageSkeleton /></AppShell>;
  if (ticket.isError) {
    return (
      <AppShell>
        {isApiError(ticket.error) && ticket.error.status === 404 ? (
          <EmptyState title="Ticket not found" description="It may belong to another organization." action={<Button asChild variant="outline"><Link to="/support"><ArrowLeft aria-hidden /> Support</Link></Button>} />
        ) : (
          <ErrorState description="The ticket couldn't be loaded." onRetry={() => void ticket.refetch()} />
        )}
      </AppShell>
    );
  }
  const data = ticket.data;
  const closed = data.status === "closed";

  const reply = () => {
    setBusy("reply");
    void replyToTicket(ticketId, message.trim())
      .then(() => {
        setMessage("");
        refresh();
      })
      .catch((err: unknown) => toast.error(isApiError(err) && err.reason === "ticket_closed" ? "This ticket is closed. Open a new one." : "The reply couldn't be sent."))
      .finally(() => setBusy(null));
  };

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit"><Link to="/support"><ArrowLeft aria-hidden /> Support</Link></Button>
      <PageHeader
        title={data.subject}
        description={`${data.number} · opened ${formatDateTime(data.created_at)}`}
        meta={<StatusBadge tone={TICKET_STATUS[data.status].tone}>{TICKET_STATUS[data.status].label}</StatusBadge>}
        actions={!closed ? <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setConfirmClose(true)}>Close ticket</Button> : undefined}
      />
      <ol className="space-y-3">
        {(data.thread ?? []).map((entry) => (
          <li
            key={entry.id}
            className={cn("max-w-2xl rounded-lg border p-3", entry.author.kind === "team" ? "border-primary/25 bg-brand-tint/40" : "ml-auto border-border bg-surface")}
          >
            <p className="text-xs font-semibold text-muted-foreground">{entry.author.name} · {formatDateTime(entry.created_at)}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-foreground">{entry.body}</p>
          </li>
        ))}
      </ol>
      {closed ? (
        <p className="text-sm text-muted-foreground">This ticket is closed. <Link to="/support" className="text-primary hover:underline">Open a new one</Link> if you need more help.</p>
      ) : (
        <div className="max-w-2xl space-y-2">
          <Textarea rows={4} placeholder="Write a reply…" value={message} onChange={(event) => setMessage(event.target.value)} />
          <Button disabled={busy !== null || !message.trim()} onClick={reply}>
            {busy === "reply" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send aria-hidden />} Send reply
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Close this ticket?"
        description="Closed tickets can't be replied to. Open a new ticket if you need more help later."
        confirmLabel="Close ticket"
        destructive={false}
        onConfirm={() => {
          setConfirmClose(false);
          setBusy("close");
          void closeTicket(ticketId)
            .then(refresh)
            .catch(() => toast.error("The ticket couldn't be closed."))
            .finally(() => setBusy(null));
        }}
      />
    </AppShell>
  );
}

export default SupportTicketPage;
