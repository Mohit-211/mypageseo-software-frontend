import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, LoaderCircle, MailPlus, ShieldCheck, Trash2, UserCog, UserPlus, UserRound, Users } from "lucide-react";
import {
  getInvitations,
  getMembers,
  inviteMember,
  isApiError,
  removeMember,
  revokeInvitation,
  updateMember,
  type Invitation,
  type OrganizationMember,
} from "@/api";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/layout/shared/feedback/states";
import { RowActions } from "@/components/layout/shared/data-table";
import { InitialsAvatar } from "@/components/team/initials-avatar";
import { InviteDialog } from "@/components/team/invite-dialog";
import { ClientChecklist, MemberClientScope } from "@/components/team/client-access";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNow } from "@/hooks/use-now";
import { formatDate, formatRelative } from "@/lib/datetime";
import { useOrganizationUsage } from "@/lib/billing/use-billing";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { byNumber, byText, byTime, sortRows } from "@/lib/sort";
import { inviteErrorText, TEAM_KEY } from "@/lib/team/team";
import { cn } from "@/lib/utils";

const ROLE_LABEL = { owner: "Owner", member: "Member", client_user: "Client (read-only)" } as const;
const ROLE_RANK = { owner: 0, member: 1, client_user: 2 } as const;

/** Team (owner only, gated by the settings layout): members, invitations and seats (3 per paid location, owner included). */
function SettingsTeamPage() {
  const workspace = useWorkspace();
  const agency = workspace.organization?.accountType === "agency";
  const queryClient = useQueryClient();
  const now = useNow();
  const members = useQuery({ queryKey: [...TEAM_KEY, "members"], queryFn: ({ signal }) => getMembers(signal) });
  const invitations = useQuery({ queryKey: [...TEAM_KEY, "invitations"], queryFn: ({ signal }) => getInvitations("pending", signal) });
  const usage = useOrganizationUsage();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<OrganizationMember | null>(null);
  const [removing, setRemoving] = useState<OrganizationMember | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const clientNames = (ids: string[]) => ids.map((id) => workspace.clients.find((client) => client.id === id)?.name ?? "Client").join(", ");
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: TEAM_KEY });
    void queryClient.invalidateQueries({ queryKey: ["organization", "usage"] });
  };
  /** "All clients", the client names, or "No clients assigned" for a limited member whose clients were deleted. */
  const clientScope = (member: OrganizationMember) => {
    const limited = member.role === "client_user" || member.restricted;
    if (!limited) return "All clients";
    const names = member.client_ids.filter((id) => workspace.clients.some((client) => client.id === id));
    return names.length ? clientNames(names) : "No clients assigned";
  };

  const run = (id: string, action: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(id);
    void action()
      .then(() => toast.success(success))
      .catch((err: unknown) => toast.error(isApiError(err) && err.reason === "owner_protected" ? "The owner can't be changed or removed." : "That didn't work. Try again."))
      .finally(() => {
        setBusy(null);
        refresh();
      });
  };

  const resend = (invitation: Invitation) => {
    if (busy) return;
    setBusy(invitation.invitation_id);
    // Inviting the same email again sends a fresh link; the old one stops working.
    void inviteMember({ email: invitation.email, role: invitation.role, ...(invitation.client_ids.length ? { client_ids: invitation.client_ids } : {}) })
      .then(() => toast.success(`A new invitation is on its way to ${invitation.email}.`))
      .catch((err: unknown) => toast.error(inviteErrorText(err)))
      .finally(() => {
        setBusy(null);
        refresh();
      });
  };

  // Owner first, then members, then client users; A–Z within each.
  const people = members.data ? sortRows(members.data, byNumber((member) => ROLE_RANK[member.role]), byText((member) => member.name || member.email)) : [];
  const pending = invitations.data ?? [];
  const seats = usage.data?.users;
  const full = seats ? seats.used >= seats.limit : false;

  return (
    <div className="space-y-6">
      <section aria-labelledby="team-seats-title" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-card sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-tint text-primary ring-1 ring-inset ring-primary/20">
            <Users className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="team-seats-title" className="text-[15px] font-semibold text-foreground">
              {seats ? `${seats.used} of ${seats.limit} seats used` : "Your team"}
            </h2>
            <p className="text-sm text-muted-foreground">Each paid location includes 3 users, shared across the team and the owner included. Pending invitations count.</p>
            {seats ? (
              <span
                role="meter"
                aria-label="Seats used"
                aria-valuemin={0}
                aria-valuemax={seats.limit}
                aria-valuenow={seats.used}
                className="mt-3 block h-2 max-w-md overflow-hidden rounded-full bg-muted"
              >
                <span className={cn("block h-full rounded-full", full ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(seats.used / Math.max(seats.limit, 1), 1) * 100}%` }} />
              </span>
            ) : null}
            {full ? <p className="mt-2 text-xs font-medium text-warning-foreground">All seats are in use. Add a location in Billing to free up more.</p> : null}
          </div>
        </div>
        <Button onClick={() => setInviting(true)} className="sm:self-center">
          <UserPlus aria-hidden /> Invite people
        </Button>
      </section>

      <Panel title="People" description={members.data ? `${people.length} ${people.length === 1 ? "person has" : "people have"} access.` : undefined} icon={Users} tone="clients">
        {members.isPending ? (
          <ListSkeleton rows={3} className="-m-4 rounded-none border-0 shadow-none" />
        ) : members.isError ? (
          <ErrorState compact title="People couldn't be loaded" description="Check your connection and try again." onRetry={() => void members.refetch()} className="shadow-none" />
        ) : (
          <ul className="-m-4 divide-y divide-border">
            {people.map((member) => {
              const scope = agency && member.role !== "owner" ? clientScope(member) : null;
              return (
                <li key={member.user_id} className="flex items-start gap-3 px-4 py-3 sm:items-center">
                  <InitialsAvatar name={member.name} fallback={member.email} />
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{member.name || member.email}</p>
                      <p className="text-xs text-muted-foreground sm:truncate">
                        <span className="block truncate sm:inline">{member.email}</span>
                        {member.joined_at ? (
                          <span className="block sm:inline">
                            <span aria-hidden className="hidden sm:inline">
                              {" · "}
                            </span>
                            Joined {formatDate(member.joined_at)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:mt-0 sm:justify-end">
                      {scope === "No clients assigned" ? (
                        <StatusBadge tone="warning">No clients assigned</StatusBadge>
                      ) : scope ? (
                        <span className="max-w-56 truncate text-xs text-muted-foreground" title={scope}>
                          {scope}
                        </span>
                      ) : null}
                      <RoleBadge role={member.role} />
                    </div>
                  </div>
                  <div className="grid w-8 shrink-0 place-items-center">
                    {member.role === "owner" ? null : busy === member.user_id ? (
                      <LoaderCircle aria-label="Working…" className="size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <RowActions label={`Actions for ${member.name || member.email}`} disabled={busy !== null}>
                        <DropdownMenuItem onSelect={() => setEditing(member)}>
                          <UserCog aria-hidden /> Change access
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-critical focus:text-critical [&>svg]:text-critical" onSelect={() => setRemoving(member)}>
                          <Trash2 aria-hidden /> Remove from team
                        </DropdownMenuItem>
                      </RowActions>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Pending invitations" description="Newest first. Each link works for 7 days." icon={MailPlus} tone="settings">
        {invitations.isPending ? (
          <ListSkeleton rows={2} className="-m-4 rounded-none border-0 shadow-none" />
        ) : invitations.isError ? (
          <ErrorState compact title="Invitations couldn't be loaded" description="Check your connection and try again." onRetry={() => void invitations.refetch()} className="shadow-none" />
        ) : pending.length === 0 ? (
          <EmptyState
            compact
            variant="all-done"
            title="No invitations waiting"
            description="Everyone you invited has joined."
            action={
              <Button size="sm" variant="outline" onClick={() => setInviting(true)}>
                <UserPlus aria-hidden /> Invite people
              </Button>
            }
            className="border-0"
          />
        ) : (
          <ul className="-m-4 divide-y divide-border">
            {sortRows(pending, byTime((invitation) => invitation.created_at)).map((invitation) => (
              <li key={invitation.invitation_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-border-strong text-muted-foreground">
                  <MailPlus className="size-4" />
                </span>
                <div className="min-w-0 flex-[1_1_14rem]">
                  <p className="truncate text-sm font-semibold text-foreground">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground sm:truncate">
                    {ROLE_LABEL[invitation.role]}
                    {invitation.client_ids.length ? ` · ${clientNames(invitation.client_ids)}` : ""} · expires {formatRelative(invitation.expires_at, now)}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <Button size="sm" variant="outline" disabled={busy !== null} aria-busy={busy === invitation.invitation_id || undefined} onClick={() => resend(invitation)}>
                    {busy === invitation.invitation_id ? <LoaderCircle aria-hidden className="animate-spin" /> : <MailPlus aria-hidden />} Send again
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-critical hover:text-critical"
                    disabled={busy !== null}
                    onClick={() => run(invitation.invitation_id, () => revokeInvitation(invitation.invitation_id), "Invitation revoked.")}
                  >
                    Revoke
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
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
            run(target.user_id, () => updateMember(target.user_id, { role, client_ids: clientIds }), `Access updated for ${target.name || target.email}.`);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
        title={`Remove ${removing?.name || removing?.email || "this person"}?`}
        description="They lose access to this organization right away. Their account stays, and you can invite them again."
        confirmLabel="Remove from team"
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) run(target.user_id, () => removeMember(target.user_id), `${target.name || target.email} removed.`);
        }}
      />
    </div>
  );
}

function RoleBadge({ role }: { role: OrganizationMember["role"] }) {
  if (role === "owner") {
    return (
      <StatusBadge tone="brand" icon={ShieldCheck}>
        Owner
      </StatusBadge>
    );
  }
  if (role === "client_user") {
    return (
      <StatusBadge tone="neutral" icon={Eye}>
        Client (read-only)
      </StatusBadge>
    );
  }
  return (
    <StatusBadge tone="info" icon={UserRound}>
      Member
    </StatusBadge>
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
  const options = [
    { value: "member", title: "Member", description: "Works on locations, reports and posts. Can't change settings, the team or billing." },
    ...(agency ? [{ value: "client_user", title: "Client (read-only)", description: "Sees only their clients' locations, reports and dashboard." }] : []),
  ] as const;

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Access for {member.name || member.email}</DialogTitle>
          <DialogDescription>Ownership can't be transferred.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {agency ? (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium text-foreground">Role</legend>
              <RadioGroup value={role} onValueChange={(value) => setRole(value as "member" | "client_user")} aria-label="Role">
                {options.map((option) => (
                  <label
                    key={option.value}
                    htmlFor={`access-role-${option.value}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
                      role === option.value ? "border-primary bg-brand-tint/60" : "border-border-strong bg-card hover:bg-accent/60",
                    )}
                  >
                    <RadioGroupItem id={`access-role-${option.value}`} value={option.value} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{option.title}</span>
                      <span className="block text-xs text-muted-foreground">{option.description}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
          ) : (
            <p className="rounded-lg bg-surface-strong px-3 py-2.5 text-sm text-muted-foreground">
              Members work on locations, reports and posts. Only the owner changes settings, the team and billing.
            </p>
          )}
          {role === "client_user" ? <ClientChecklist label="Clients they can see" value={clientIds} onChange={setClientIds} /> : null}
          {role === "member" && agency ? <MemberClientScope limited={limited} onLimitedChange={setLimited} clientIds={clientIds} onClientIdsChange={setClientIds} /> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={needsClients && clientIds.length === 0} onClick={() => onSave(role, needsClients ? clientIds : [])}>
            Save access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsTeamPage;
