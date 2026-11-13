import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, ChevronRight, LifeBuoy, LoaderCircle, MessagesSquare, Plus, Send } from "lucide-react";
import { createTicket, getTickets, type Ticket, type TicketCategory } from "@/api";
import { SUPPORT_KEY, TICKET_CATEGORY_LABEL, TICKET_STATUS } from "@/lib/support/tickets";
import { PageHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { FormAlert, FormSelectField, FormTextField, FormTextareaField } from "@/components/layout/shared/form-fields";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/layout/shared/feedback/states";
import { TablePagination } from "@/components/layout/shared/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNow } from "@/hooks/use-now";
import { formatDateTime, formatRelative } from "@/lib/datetime";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { keepScrollEntry, setParam, useSearchUpdater } from "@/lib/url-state";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

/**
 * Support tickets with the MyPageSEO team (Phase 13b), latest activity first. `?new=1` opens the
 * new-ticket form, so "Contact support" and "Open a ticket" elsewhere land straight on it.
 */
function SupportPage() {
  const [page, setPage] = useState(1);
  const tickets = useQuery({
    queryKey: [...SUPPORT_KEY, "list", page],
    queryFn: ({ signal }) => getTickets({ page, limit: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });
  const [params] = useSearchParams();
  const creating = params.get("new") === "1";
  const updateSearch = useSearchUpdater();
  const location = useLocation();
  const navigate = useNavigate();
  const setCreating = (open: boolean) => updateSearch((next) => setParam(next, "new", open ? "1" : null));
  const openTicket = async (ticketId: string) => {
    // Close the form in the address first (same entry, same scroll), so Back from the new ticket
    // returns to the list instead of an empty form.
    const rest = new URLSearchParams(location.search);
    rest.delete("new");
    const search = rest.toString();
    await navigate({ pathname: location.pathname, search: search ? `?${search}` : "", hash: location.hash }, { replace: true, preventScrollReset: true, state: keepScrollEntry(location) });
    await navigate(`/support/${encodeURIComponent(ticketId)}`);
  };
  const newTicket = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden /> New ticket
    </Button>
  );

  return (
    <>
      <PageHeader
        icon={LifeBuoy}
        tone="help"
        title="Support"
        description="Ask the MyPageSEO team anything. We reply here and by email."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/help">
                <BookOpen aria-hidden /> Help articles
              </Link>
            </Button>
            {newTicket}
          </>
        }
      />
      {tickets.isPending ? (
        <ListSkeleton rows={4} />
      ) : tickets.isError ? (
        <ErrorState title="Your tickets couldn't be loaded" description="Check your connection and try again." onRetry={() => void tickets.refetch()} />
      ) : tickets.data.tickets.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          tone="help"
          title="No tickets yet"
          description="Ask about anything: a ranking that looks off, a report, billing or how something works. The team replies here and by email."
          action={newTicket}
          secondaryAction={
            <Button asChild variant="outline">
              <Link to="/help">Browse help</Link>
            </Button>
          }
        />
      ) : (
        <section aria-label="Your tickets" className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <ul className="divide-y divide-border">
            {tickets.data.tickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </ul>
          {tickets.data.total > tickets.data.limit ? (
            <TablePagination
              page={tickets.data.page}
              pageCount={Math.ceil(tickets.data.total / tickets.data.limit)}
              totalItems={tickets.data.total}
              pageSize={tickets.data.limit}
              itemLabel="tickets"
              onPageChange={setPage}
            />
          ) : null}
        </section>
      )}
      {creating ? <NewTicketDialog onClose={() => setCreating(false)} onSent={(ticketId) => void openTicket(ticketId)} /> : null}
    </>
  );
}

function TicketRow({ ticket }: { ticket: Ticket }) {
  const now = useNow();
  const status = TICKET_STATUS[ticket.status];
  const waiting = ticket.status === "waiting_on_customer";
  const activity = ticket.last_message_at ?? ticket.created_at;
  return (
    <li>
      <Link
        to={`/support/${encodeURIComponent(ticket.id)}`}
        className={cn(
          "group flex items-center gap-3 px-4 py-3.5 outline-hidden transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          waiting && "bg-warning-surface/50",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-inset",
            ticket.status === "resolved" || ticket.status === "closed" ? "bg-muted text-muted-foreground ring-border-strong" : "bg-brand-tint text-primary ring-primary/20",
          )}
        >
          <MessagesSquare className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          {/* Two lines on phones, so a long subject still reads; one line beside the status column. */}
          <span className="line-clamp-2 break-words text-sm font-semibold text-foreground group-hover:text-primary sm:line-clamp-1">{ticket.subject}</span>
          <span className="block text-xs text-muted-foreground sm:truncate">
            {ticket.number}
            {ticket.category ? ` · ${TICKET_CATEGORY_LABEL[ticket.category] ?? ticket.category}` : ""} · {ticket.messages} message{ticket.messages === 1 ? "" : "s"} ·{" "}
            <span title={formatDateTime(activity)}>
              {ticket.last_message_at ? "last reply" : "opened"} {formatRelative(activity, now)}
            </span>
          </span>
          {/* On phones the status sits under the title; on wider screens it gets its own column. */}
          <StatusBadge tone={status.tone} dot className="mt-1.5 sm:hidden">
            {status.label}
          </StatusBadge>
        </span>
        <StatusBadge tone={status.tone} dot className="hidden sm:inline-flex">
          {status.label}
        </StatusBadge>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
      </Link>
    </li>
  );
}

function NewTicketDialog({ onClose, onSent }: { onClose: () => void; onSent: (ticketId: string) => void }) {
  const workspace = useWorkspace();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>("technical");
  const [locationId, setLocationId] = useState<string>(workspace.activeLocation?.id ?? "none");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ subject?: string; message?: string }>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    if (saving) return;
    const next: typeof errors = {};
    if (subject.trim().length < 3) next.subject = "Give it a short subject (3 characters or more).";
    if (message.trim().length < 3) next.message = "Tell us a little more (3 characters or more).";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    setError(null);
    void createTicket({ subject: subject.trim(), message: message.trim(), category, ...(locationId !== "none" ? { location_id: locationId } : {}) })
      .then((ticket) => {
        toast.success(`Ticket ${ticket.number} opened`, { description: "We'll reply here and by email." });
        onSent(ticket.id);
      })
      .catch(() => setError("The ticket couldn't be sent. Try again."))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New support ticket</DialogTitle>
          <DialogDescription>Tell us what you need. Mention the screen you were on and what you expected to see.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <FormTextField
            id="ticket-subject"
            label="Subject"
            required
            maxLength={200}
            autoFocus
            value={subject}
            error={errors.subject}
            disabled={saving}
            onChange={(value) => {
              setSubject(value);
              setErrors((current) => ({ ...current, subject: undefined }));
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormSelectField
              id="ticket-topic"
              label="Topic"
              value={category}
              disabled={saving}
              onChange={(value) => setCategory(value as TicketCategory)}
              options={(Object.keys(TICKET_CATEGORY_LABEL) as TicketCategory[]).map((value) => ({ value, label: TICKET_CATEGORY_LABEL[value] }))}
            />
            <FormSelectField
              id="ticket-location"
              label="Location"
              optional
              value={locationId}
              disabled={saving}
              onChange={setLocationId}
              options={[{ value: "none", label: "Not about a location" }, ...workspace.locations.map((location) => ({ value: location.id, label: location.businessName }))]}
            />
          </div>
          <FormTextareaField
            id="ticket-message"
            label="Message"
            required
            rows={5}
            value={message}
            error={errors.message}
            disabled={saving}
            hint="Include what you clicked and what happened, so we can help faster."
            onChange={(value) => {
              setMessage(value);
              setErrors((current) => ({ ...current, message: undefined }));
            }}
          />
          {error ? <FormAlert>{error}</FormAlert> : null}
          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} aria-busy={saving || undefined}>
              {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send aria-hidden />} {saving ? "Sending…" : "Send ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default SupportPage;
