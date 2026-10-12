import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { inviteMember } from "@/api";
import { TEAM_KEY, inviteErrorText } from "@/lib/team/team";
import { Button } from "@/components/ui/button";
import { ClientChecklist, MemberClientScope } from "./client-access";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/lib/mypageseo/workspace";

/** Invite a member, or (agency) a read-only client user for chosen clients. The link is valid 7 days. */
export function InviteDialog({ onClose, clientId }: { onClose: () => void; clientId?: string }) {
  const workspace = useWorkspace();
  const queryClient = useQueryClient();
  const agency = workspace.organization?.accountType === "agency";
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "client_user">(clientId ? "client_user" : "member");
  const [clientIds, setClientIds] = useState<string[]>(clientId ? [clientId] : []);
  const [limited, setLimited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const scoped = role === "client_user" || (agency && limited);
      const invitation = await inviteMember({ email: email.trim(), role, ...(scoped ? { client_ids: clientIds } : {}) });
      void queryClient.invalidateQueries({ queryKey: TEAM_KEY });
      toast.success(invitation.email_sent === false ? "Invitation created. (Emails are off on this server; the link is in the server log.)" : `Invitation sent to ${invitation.email}.`);
      onClose();
    } catch (err) {
      setError(inviteErrorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>They get an email with a link that's valid for 7 days.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          {agency && !clientId ? (
            <div className="space-y-1.5">
              <Label>Access</Label>
              <Select value={role} onValueChange={(value) => setRole(value as "member" | "client_user")}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Team member: everything except settings, team and billing</SelectItem>
                  <SelectItem value="client_user">Client: read-only, only their locations</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {role === "client_user" && !clientId ? <ClientChecklist label="Clients they can see" value={clientIds} onChange={setClientIds} /> : null}
          {role === "member" && agency ? (
            <MemberClientScope limited={limited} onLimitedChange={setLimited} clientIds={clientIds} onClientIdsChange={setClientIds} />
          ) : null}
          {role === "client_user" ? <p className="text-xs text-muted-foreground">Client users can read their locations, reports and dashboard, and approve posts when client approval is on. They can't change anything else.</p> : null}
          {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button disabled={saving || ((role === "client_user" || (role === "member" && limited)) && clientIds.length === 0)} onClick={() => void send()}>
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
