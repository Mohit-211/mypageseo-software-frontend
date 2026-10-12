import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle, Trash2, UserPlus } from "lucide-react";
import {
  getInvitations,
  getMembers,
  isApiError,
  removeMember,
  revokeInvitation,
  updateMember,
  type OrganizationMember,
} from "@/api";
import { RequireAccess } from "@/components/mypageseo/access";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { SettingsNav } from "@/components/settings/settings-nav";
import { InviteDialog } from "@/components/team/invite-dialog";
import { ClientChecklist, MemberClientScope } from "@/components/team/client-access";
import { TEAM_KEY } from "@/lib/team/team";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/datetime";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useOrganizationUsage } from "@/lib/billing/use-billing";

const ROLE_LABEL = { owner: "Owner", member: "Member", client_user: "Client (read-only)" } as const;

/** Team (owner only): members, invitations and the user limit (3 per paid location, owner included). */
const SettingsTeamPage = () => (
  <RequireAccess permission="team.view">
    <TeamSettingsPage />
  </RequireAccess>
);

function TeamSettingsPage() {
  const workspace = useWorkspace();
  const agency = workspace.organization?.accountType === "agency";
  const queryClient = useQueryClient();
  const members = useQuery({ queryKey: [...TEAM_KEY, "members"], queryFn: ({ signal }) => getMembers(signal) });
  const invitations = useQuery({ queryKey: [...TEAM_KEY, "invitations"], queryFn: ({ signal }) => getInvitations("pending", signal) });
  const usage = useOrganizationUsage();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<OrganizationMember | null>(null);
  const [removing, setRemoving] = useState<OrganizationMember | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const clientNames = (ids: string[]) => ids.map((id) => workspace.clients.find((client) => client.id === id)?.name ?? "Client").join(", ");
  const refresh = () => void queryClient.invalidateQueries({ queryKey: TEAM_KEY });
  /** "All clients", the client names, or "No clients assigned" for a limited member whose clients were deleted. */
  const clientScope = (member: OrganizationMember) => {
    const limited = member.role === "client_user" || member.restricted;
    if (!limited) return "All clients";
    const names = member.client_ids.filter((id) => workspace.clients.some((client) => client.id === id));
    return names.length ? clientNames(names) : "No clients assigned";
  };

  const run = (id: string, action: () => Promise<unknown>, success: string) => {
    setBusy(id);
    void action()
      .then(() => toast.success(success))
      .catch((err: unknown) => toast.error(isApiError(err) && err.reason === "owner_protected" ? "The owner can't be changed or removed." : "That didn't work. Try again."))
      .finally(() => {
        setBusy(null);
        refresh();
        void queryClient.invalidateQueries({ queryKey: ["organization", "usage"] });
      });
  };

  return (
    <AppShell>
      <PageHeader
        title="Team"
        description="Who can use this organization. Each paid location includes 3 users, pooled, the owner included."
        meta={usage.data ? <p className="text-xs text-muted-foreground">{usage.data.users.used} of {usage.data.users.limit} users (pending invitations count)</p> : undefined}
        actions={<Button size="sm" onClick={() => setInviting(true)}><UserPlus aria-hidden /> Invite</Button>}
      />
      <SettingsNav active="team" isAgency={agency} />

      <Panel title="Members">
        {members.isPending ? (
          <TableSkeleton rows={3} columns={4} />
        ) : members.isError ? (
          <ErrorState description="Members couldn't be loaded." onRetry={() => void members.refetch()} />
        ) : (
          <ul className="-m-4 divide-y divide-border">
            {members.data.map((member) => (
              <li key={member.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email}
                    {member.joined_at ? ` · joined ${formatDate(member.joined_at)}` : ""}
                    {agency && member.role !== "owner" ? ` · ${clientScope(member)}` : ""}
                  </p>
                </div>
                {agency && member.role !== "owner" && clientScope(member) === "No clients assigned" ? (
                  <StatusBadge tone="warning">No clients assigned</StatusBadge>
                ) : null}
                <StatusBadge tone={member.role === "owner" ? "brand" : "neutral"}>{ROLE_LABEL[member.role]}</StatusBadge>
                {member.role !== "owner" ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setEditing(member)}>Change access</Button>
                    <Button size="icon" variant="ghost" className="size-8 text-critical" aria-label={`Remove ${member.name}`} disabled={busy !== null} onClick={() => setRemoving(member)}>
                      {busy === member.user_id ? <LoaderCircle aria-hidden className="animate-spin" /> : <Trash2 aria-hidden />}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Pending invitations">
        {invitations.isPending ? (
          <TableSkeleton rows={2} columns={3} />
        ) : invitations.isError ? (
          <ErrorState description="Invitations couldn't be loaded." onRetry={() => void invitations.refetch()} />
        ) : invitations.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invitations.</p>
        ) : (
          <ul className="-m-4 divide-y divide-border">
            {invitations.data.map((invitation) => (
              <li key={invitation.invitation_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABEL[invitation.role]}
                    {invitation.role === "client_user" ? ` · ${clientNames(invitation.client_ids)}` : ""} · expires {formatDate(invitation.expires_at)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-critical"
                  disabled={busy !== null}
                  onClick={() => run(invitation.invitation_id, () => revokeInvitation(invitation.invitation_id), "Invitation revoked.")}
                >
                  {busy === invitation.invitation_id ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Inviting the same email again sends a new link; the old one stops working.</p>
      </Panel>

      {inviting ? <InviteDialog onClose={() => setInviting(false)} /> : null}
      {editing ? (
        <AccessDialog
          member={editing}
          agency={agency}
          onClose={() => setEditing(null)}
          onSave={(role, clientIds) => {
            const target = editing;
            setEditing(null);
            // `client_ids: []` on a member gives access to all clients again.
            run(target.user_id, () => updateMember(target.user_id, { role, client_ids: clientIds }), "Access updated.");
          }}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
        title={`Remove ${removing?.name ?? "this person"}?`}
        description="They lose access to this organization immediately. Their account stays, and you can invite them again."
        confirmLabel="Remove"
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) run(target.user_id, () => removeMember(target.user_id), `${target.name} removed.`);
        }}
      />
    </AppShell>
  );
}

function AccessDialog({
  member,
  agency,
  onClose,
  onSave,
}: {
  member: OrganizationMember;
  agency: boolean;
  onClose: () => void;
  onSave: (role: "member" | "client_user", clientIds: string[]) => void;
}) {
  const [role, setRole] = useState<"member" | "client_user">(member.role === "client_user" ? "client_user" : "member");
  const [clientIds, setClientIds] = useState<string[]>(member.client_ids);
  const [limited, setLimited] = useState(member.role === "member" && Boolean(member.restricted));
  const needsClients = role === "client_user" || (role === "member" && limited);
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Access for {member.name}</DialogTitle>
          <DialogDescription>Ownership can't be transferred.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={role} onValueChange={(value) => setRole(value as "member" | "client_user")} disabled={!agency}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              {agency ? <SelectItem value="client_user">Client (read-only)</SelectItem> : null}
            </SelectContent>
          </Select>
          {role === "client_user" ? <ClientChecklist label="Clients they can see" value={clientIds} onChange={setClientIds} /> : null}
          {role === "member" && agency ? (
            <MemberClientScope limited={limited} onLimitedChange={setLimited} clientIds={clientIds} onClientIdsChange={setClientIds} />
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={needsClients && clientIds.length === 0} onClick={() => onSave(role, needsClients ? clientIds : [])}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsTeamPage;
