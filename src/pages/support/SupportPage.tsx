import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { LifeBuoy, LoaderCircle, Plus } from "lucide-react";
import { createTicket, getTickets, type TicketCategory } from "@/api";
import { SUPPORT_KEY, TICKET_STATUS } from "@/lib/support/tickets";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/datetime";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const CATEGORY_LABEL: Record<TicketCategory, string> = {
  technical: "Something isn't working",
  data: "Rankings or data question",
  billing: "Billing",
  account: "Account or access",
  other: "Something else",
};

/** Support tickets with the MyPageSEO team (Phase 13b). */
function SupportPage() {
  const tickets = useQuery({ queryKey: SUPPORT_KEY, queryFn: ({ signal }) => getTickets({ limit: 50 }, signal) });
  const [creating, setCreating] = useState(false);

  return (
    <AppShell>
      <PageHeader
        title="Support"
        description="Ask the MyPageSEO team for help. We reply here and by email."
        actions={<Button size="sm" onClick={() => setCreating(true)}><Plus aria-hidden /> New ticket</Button>}
      />
      {tickets.isPending ? (
        <TableSkeleton rows={3} columns={4} />
      ) : tickets.isError ? (
        <ErrorState description="Your tickets couldn't be loaded." onRetry={() => void tickets.refetch()} />
      ) : tickets.data.tickets.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No tickets yet" description="Open a ticket and the team gets back to you here." action={<Button size="sm" onClick={() => setCreating(true)}><Plus aria-hidden /> New ticket</Button>} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          {tickets.data.tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link to={`/support/${ticket.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.number} · {ticket.last_message_at ? `last message ${formatDateTime(ticket.last_message_at)}` : `opened ${formatDateTime(ticket.created_at)}`}
                  </p>
                </div>
                <StatusBadge tone={TICKET_STATUS[ticket.status].tone}>{TICKET_STATUS[ticket.status].label}</StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating ? <NewTicketDialog onClose={() => setCreating(false)} /> : null}
    </AppShell>
  );
}

function NewTicketDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>("technical");
  const [locationId, setLocationId] = useState<string>(workspace.activeLocation?.id ?? "none");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const send = () => {
    setSaving(true);
    void createTicket({ subject: subject.trim(), message: message.trim(), category, ...(locationId !== "none" ? { location_id: locationId } : {}) })
      .then((ticket) => {
        toast.success(`Ticket ${ticket.number} opened.`);
        navigate(`/support/${ticket.id}`);
      })
      .catch(() => toast.error("The ticket couldn't be sent. Try again."))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New support ticket</DialogTitle>
          <DialogDescription>Tell us what you need; include the screen and what you expected to see.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="ticket-subject">Subject</Label><Input id="ticket-subject" value={subject} maxLength={200} onChange={(event) => setSubject(event.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Topic</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as TicketCategory)}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(CATEGORY_LABEL) as TicketCategory[]).map((value) => <SelectItem key={value} value={value}>{CATEGORY_LABEL[value]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Location (optional)</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not about a location</SelectItem>
                  {workspace.locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.businessName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="ticket-message">Message</Label><Textarea id="ticket-message" rows={5} value={message} onChange={(event) => setMessage(event.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button disabled={saving || subject.trim().length < 3 || message.trim().length < 3} onClick={send}>
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SupportPage;
