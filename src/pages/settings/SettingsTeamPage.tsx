import { useMemo, useState } from "react";
import { RequireAccess } from "@/components/mypageseo/access";
import { Link } from "react-router-dom";
import { ArrowLeft, MoreHorizontal, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/shared/app-shell";
import { SettingsNav } from "@/components/settings/settings-nav";
import { PageHeader, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  ConfirmDialog,
  FieldMessage,
  FormSelectField,
  FormTextField,
  RequiredFieldsNote,
  SubmitButton,
  useSubmitGuard,
} from "@/components/layout/shared/form-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TEAM_PAGE_SIZE,
  TEAM_STATUS_LABEL,
  TEAM_STATUS_TONE,
  getTeam,
  validateTeamInvite,
  type TeamInviteErrors,
  type TeamMember,
  type TeamRole,
} from "@/lib/mypageseo/team";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const SettingsTeamPage = () => (
    <RequireAccess permission="team.view">
      <TeamSettingsPage />
    </RequireAccess>
  );

type PendingAction =
  | { kind: "deactivate"; member: TeamMember }
  | { kind: "remove"; member: TeamMember }
  | { kind: "revoke"; member: TeamMember };

const DESCRIPTION =
  "Organization administrators manage internal team members and their access to Mypageseo.";

function TeamSettingsPage() {
  const workspace = useWorkspace();
  const organization = workspace.organization;
  const accountType = organization?.accountType === "agency" ? "agency" : "business";

  const result = getTeam(organization?.id ?? "org", accountType);

  const baseMembers = result.status === "ready" ? result.members : [];
  const roles: TeamRole[] = result.status === "ready" || result.status === "no_members" ? result.roles : [];
  const capabilities = result.status === "loading" || result.status === "error" ? null : result.capabilities;

  /**
   * Local overlay for actions taken in this session. No team write endpoint is
   * connected, so changes are held in the frontend only.
   */
  const [overrides, setOverrides] = useState<Record<string, Partial<TeamMember>>>({});
  const [added, setAdded] = useState<TeamMember[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TeamMember["status"]>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const members = useMemo(() => {
    return [...baseMembers, ...added]
      .filter((member) => !removed.includes(member.id))
      .map((member) => ({ ...member, ...(overrides[member.id] ?? {}) }));
  }, [baseMembers, added, removed, overrides]);

  const clientName = (clientId: string) =>
    workspace.clients.find((client) => client.id === clientId)?.name ?? clientId;

  const roleLabel = (roleId: string | null) => roles.find((role) => role.id === roleId)?.label ?? "—";

  const needle = query.trim().toLowerCase();
  const filtered = members.filter((member) => {
    const matchesQuery = !needle || `${member.name ?? ""} ${member.email}`.toLowerCase().includes(needle);
    const matchesStatus = statusFilter === "all" || member.status === statusFilter;
    const matchesRole = roleFilter === "all" || member.roleId === roleFilter;
    return matchesQuery && matchesStatus && matchesRole;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / TEAM_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * TEAM_PAGE_SIZE, safePage * TEAM_PAGE_SIZE);
  const pendingInvites = members.filter((member) => member.status === "invited").length;

  const applyUpdate = (member: TeamMember, patch: Partial<TeamMember>) => {
    setOverrides((current) => ({ ...current, [member.id]: { ...(current[member.id] ?? {}), ...patch } }));
  };

  const confirmPending = () => {
    if (!pending) return;
    const { kind, member } = pending;
    if (kind === "deactivate") {
      applyUpdate(member, { status: "deactivated" });
      toast.success(`${member.name ?? member.email} was deactivated`);
    } else if (kind === "remove") {
      setRemoved((current) => [...current, member.id]);
      toast.success(`${member.name ?? member.email} was removed from the team`);
    } else {
      setRemoved((current) => [...current, member.id]);
      toast.success(`Invitation to ${member.email} was revoked`);
    }
    setPending(null);
  };

  if (workspace.status === "loading" || result.status === "loading") {
    return (
      <AppShell>
        <PageHeader title="Team" description={DESCRIPTION} />
        <SettingsTabs />
        <div className="mt-5">
          <TableSkeleton rows={6} columns={6} />
        </div>
      </AppShell>
    );
  }

  if (workspace.status === "unavailable" || !organization) {
    return (
      <AppShell>
        <PageHeader title="Team" description={DESCRIPTION} />
        <SettingsTabs />
        <div className="mt-5">
          <ErrorState
            description="We couldn't load your organization, so team access can't be shown right now."
            onRetry={() => window.location.reload()}
          />
        </div>
      </AppShell>
    );
  }

  const inviteButton = (label = "Invite team member") =>
    capabilities?.canInvite ? (
      <Button size="sm" onClick={() => setInviteOpen(true)}>
        <UserPlus aria-hidden /> {label}
      </Button>
    ) : null;

  return (
    <AppShell>
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/settings">
            <ArrowLeft aria-hidden /> Back to settings
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Team"
        description={DESCRIPTION}
        meta={
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge tone="brand">{organization.name}</StatusBadge>
            <span>{accountType === "agency" ? "Agency organization" : "Business organization"}</span>
            {pendingInvites > 0 ? (
              <span>
                · {pendingInvites} invitation{pendingInvites === 1 ? "" : "s"} pending
              </span>
            ) : null}
          </div>
        }
        actions={inviteButton()}
      />

      <SettingsTabs isAgency={accountType === "agency"} />

      <div className="mt-5 space-y-4">
        {result.status === "error" ? (
          <ErrorState description={result.message} onRetry={() => window.location.reload()} />
        ) : result.status === "unavailable" ? (
          <EmptyState title="Team management is not available for this organization" description={result.reason} />
        ) : members.length === 0 ? (
          <EmptyState
            title="No team members yet"
            description="Invite colleagues so they can work on locations, rankings, Google Business Profiles and reports with you."
            action={inviteButton("Invite your first team member") ?? undefined}
          />
        ) : (
          <Panel
            title="Team members"
            description={`${filtered.length} of ${members.length} member${members.length === 1 ? "" : "s"}`}
          >
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  aria-label="Search team members"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name or email"
                  className="h-9 pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as typeof statusFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 sm:w-44" aria-label="Filter by status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="invited">Invitation pending</SelectItem>
                  <SelectItem value="deactivated">Deactivated</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 sm:w-48" aria-label="Filter by role">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title="No team members match these filters"
                description="Try a different name, role or status."
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery("");
                      setStatusFilter("all");
                      setRoleFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        {capabilities?.canAssignClients ? <TableHead>Client access</TableHead> : null}
                        <TableHead>Last activity</TableHead>
                        <TableHead className="w-12 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="font-medium text-foreground">
                              {member.name ?? "—"}
                              {member.isCurrentUser ? (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">You</span>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground">{member.email}</div>
                          </TableCell>
                          <TableCell>{roleLabel(member.roleId)}</TableCell>
                          <TableCell>
                            <StatusBadge tone={TEAM_STATUS_TONE[member.status]}>
                              {TEAM_STATUS_LABEL[member.status]}
                            </StatusBadge>
                          </TableCell>
                          {capabilities?.canAssignClients ? (
                            <TableCell className="text-muted-foreground">
                              {member.clientIds === null
                                ? "All clients"
                                : member.clientIds.length === 0
                                  ? "No clients assigned"
                                  : member.clientIds.map(clientName).join(", ")}
                            </TableCell>
                          ) : null}
                          <TableCell className="text-muted-foreground">
                            {member.status === "invited"
                              ? member.invitedAt
                                ? `Invited ${new Date(member.invitedAt).toLocaleDateString()}`
                                : "Invitation sent"
                              : member.lastActivity
                                ? new Date(member.lastActivity).toLocaleDateString()
                                : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <MemberActions
                              member={member}
                              capabilities={capabilities}
                              onEdit={() => setEditing(member)}
                              onResend={() => toast.success(`Invitation resent to ${member.email}`)}
                              onReactivate={() => {
                                applyUpdate(member, { status: "active" });
                                toast.success(`${member.name ?? member.email} was reactivated`);
                              }}
                              onPending={setPending}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <ul className="divide-y divide-border lg:hidden">
                  {visible.map((member) => (
                    <li key={member.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {member.name ?? "—"}
                            {member.isCurrentUser ? (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">You</span>
                            ) : null}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                        </div>
                        <MemberActions
                          member={member}
                          capabilities={capabilities}
                          onEdit={() => setEditing(member)}
                          onResend={() => toast.success(`Invitation resent to ${member.email}`)}
                          onReactivate={() => {
                            applyUpdate(member, { status: "active" });
                            toast.success(`${member.name ?? member.email} was reactivated`);
                          }}
                          onPending={setPending}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <StatusBadge tone={TEAM_STATUS_TONE[member.status]}>
                          {TEAM_STATUS_LABEL[member.status]}
                        </StatusBadge>
                        <span>{roleLabel(member.roleId)}</span>
                        {capabilities?.canAssignClients ? (
                          <span>
                            ·{" "}
                            {member.clientIds === null
                              ? "All clients"
                              : member.clientIds.length === 0
                                ? "No clients assigned"
                                : member.clientIds.map(clientName).join(", ")}
                          </span>
                        ) : null}
                        {member.status !== "invited" && member.lastActivity ? (
                          <span>· Active {new Date(member.lastActivity).toLocaleDateString()}</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>

                {pageCount > 1 ? (
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>
                      Page {safePage} of {pageCount}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage <= 1}
                        onClick={() => setPage(safePage - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage >= pageCount}
                        onClick={() => setPage(safePage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </Panel>
        )}

        <Panel title="Roles" description="Access levels available in this organization">
          <ul className="divide-y divide-border">
            {roles.map((role) => (
              <li key={role.id} className="py-2.5">
                <p className="text-sm font-medium text-foreground">{role.label}</p>
                {role.description ? (
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <MemberFormDialog
        key={editing ? `edit-${editing.id}` : inviteOpen ? "invite" : "closed"}
        open={inviteOpen || editing !== null}
        mode={editing ? "edit" : "invite"}
        member={editing}
        roles={roles}
        clients={workspace.clients}
        canAssignClients={capabilities?.canAssignClients === true}
        onClose={() => {
          setInviteOpen(false);
          setEditing(null);
        }}
        onSubmit={(draft) => {
          if (editing) {
            applyUpdate(editing, {
              roleId: draft.roleId,
              clientIds: capabilities?.canAssignClients ? draft.clientIds : editing.clientIds,
            });
            toast.success(`Access updated for ${editing.name ?? editing.email}`);
            setEditing(null);
            return;
          }
          setAdded((current) => [
            ...current,
            {
              id: `tm_local_${current.length + 1}`,
              name: draft.name.trim(),
              email: draft.email.trim(),
              roleId: draft.roleId,
              status: "invited",
              lastActivity: null,
              invitedAt: new Date().toISOString(),
              clientIds: capabilities?.canAssignClients ? draft.clientIds : null,
              isCurrentUser: false,
            },
          ]);
          toast.success(`Invitation sent to ${draft.email.trim()}`);
          setInviteOpen(false);
        }}
      />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => (!open ? setPending(null) : null)}
        title={
          pending?.kind === "remove"
            ? "Remove this team member?"
            : pending?.kind === "revoke"
              ? "Revoke this invitation?"
              : "Deactivate this team member?"
        }
        description={
          pending?.kind === "remove"
            ? `${pending.member.name ?? pending.member.email} will lose access to this organization immediately and will be removed from the team list.`
            : pending?.kind === "revoke"
              ? `${pending?.member.email} will no longer be able to join using the invitation link.`
              : `${pending?.member.name ?? pending?.member.email} will keep their account but lose access until reactivated.`
        }
        confirmLabel={
          pending?.kind === "remove" ? "Remove" : pending?.kind === "revoke" ? "Revoke invitation" : "Deactivate"
        }
        onConfirm={confirmPending}
      />
    </AppShell>
  );
}

function SettingsTabs({ isAgency = false }: { isAgency?: boolean }) {
  return <SettingsNav active="team" isAgency={isAgency} className="mt-4" />;
}

function MemberActions({
  member,
  capabilities,
  onEdit,
  onResend,
  onReactivate,
  onPending,
}: {
  member: TeamMember;
  capabilities: { canEditAccess: boolean; canResendInvite: boolean; canRevokeInvite: boolean; canDeactivate: boolean; canRemove: boolean; canAssignClients: boolean } | null;
  onEdit: () => void;
  onResend: () => void;
  onReactivate: () => void;
  onPending: (action: PendingAction) => void;
}) {
  if (!capabilities) return null;

  // The signed-in administrator cannot change or revoke their own access here.
  const self = member.isCurrentUser;
  const items: { key: string; label: string; onSelect: () => void; destructive?: boolean }[] = [];

  if (capabilities.canEditAccess && !self) items.push({ key: "edit", label: "Edit access", onSelect: onEdit });
  if (member.status === "invited") {
    if (capabilities.canResendInvite) items.push({ key: "resend", label: "Resend invitation", onSelect: onResend });
    if (capabilities.canRevokeInvite)
      items.push({
        key: "revoke",
        label: "Revoke invitation",
        destructive: true,
        onSelect: () => onPending({ kind: "revoke", member }),
      });
  } else if (!self) {
    if (member.status === "deactivated") {
      items.push({ key: "reactivate", label: "Reactivate", onSelect: onReactivate });
    } else if (capabilities.canDeactivate) {
      items.push({
        key: "deactivate",
        label: "Deactivate",
        destructive: true,
        onSelect: () => onPending({ kind: "deactivate", member }),
      });
    }
    if (capabilities.canRemove)
      items.push({
        key: "remove",
        label: "Remove from team",
        destructive: true,
        onSelect: () => onPending({ kind: "remove", member }),
      });
  }

  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground">{self ? "Your account" : "—"}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${member.name ?? member.email}`}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.key}
            onSelect={item.onSelect}
            className={item.destructive ? "text-critical focus:text-critical" : undefined}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MemberFormDialog({
  open,
  mode,
  member,
  roles,
  clients,
  canAssignClients,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "invite" | "edit";
  member: TeamMember | null;
  roles: TeamRole[];
  clients: { id: string; name: string }[];
  canAssignClients: boolean;
  onClose: () => void;
  onSubmit: (draft: { name: string; email: string; roleId: string; clientIds: string[] }) => void;
}) {
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [roleId, setRoleId] = useState(member?.roleId ?? "");
  const [clientIds, setClientIds] = useState<string[]>(member?.clientIds ?? []);
  const [errors, setErrors] = useState<TeamInviteErrors>({});
  const { pending: submitting, run } = useSubmitGuard();

  const scopedRole = roleId === "client_manager";
  const requireScope = canAssignClients && scopedRole;

  const submit = () => {
    if (submitting) return;
    const draft = { name, email, roleId, clientIds };
    const found = validateTeamInvite(draft, roles, requireScope);
    if (mode === "edit") {
      delete found.name;
      delete found.email;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    void run(() => onSubmit(draft));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit access" : "Invite team member"}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Change the role and client access for this team member."
              : "Send an invitation to join your Mypageseo organization."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {mode === "invite" ? <RequiredFieldsNote /> : null}

          <FormTextField
            id="team-name"
            label="Name"
            required={mode === "invite"}
            value={name}
            disabled={mode === "edit" || submitting}
            placeholder="Full name"
            error={errors.name}
            hint={mode === "edit" ? "The member manages their own name from their profile." : undefined}
            onChange={setName}
          />

          <FormTextField
            id="team-email"
            label="Email"
            required={mode === "invite"}
            type="email"
            value={email}
            disabled={mode === "edit" || submitting}
            placeholder="name@agency.com"
            error={errors.email}
            hint={mode === "edit" ? "Sign-in email can't be changed here." : "The invitation is sent to this address."}
            onChange={setEmail}
          />

          <FormSelectField
            id="team-role"
            label="Role"
            required
            value={roleId}
            disabled={submitting}
            placeholder="Select a role"
            options={roles.map((role) => ({ value: role.id, label: role.label }))}
            error={errors.roleId}
            hint={roles.find((role) => role.id === roleId)?.description}
            onChange={setRoleId}
          />

          {canAssignClients ? (
            <fieldset className="space-y-2">
              <legend className="text-[13px] font-medium text-foreground">Client access</legend>
              <p className="text-xs text-muted-foreground">
                {scopedRole
                  ? "This role only has access to the clients selected here."
                  : "This role has access to every client in the organization."}
              </p>
              {scopedRole ? (
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                  {clients.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No clients in this organization yet.</p>
                  ) : (
                    clients.map((client) => (
                      <label key={client.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={clientIds.includes(client.id)}
                          disabled={submitting}
                          onCheckedChange={(checked) =>
                            setClientIds((current) =>
                              checked === true
                                ? [...current, client.id]
                                : current.filter((id) => id !== client.id),
                            )
                          }
                        />
                        {client.name}
                      </label>
                    ))
                  )}
                </div>
              ) : null}
              <FieldMessage error={errors.clientIds} />
            </fieldset>
          ) : null}

          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <SubmitButton
            type="button"
            pending={submitting}
            onClick={submit}
            pendingLabel={mode === "edit" ? "Saving…" : "Sending…"}
          >
            {mode === "edit" ? "Save access" : "Send invitation"}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsTeamPage;
