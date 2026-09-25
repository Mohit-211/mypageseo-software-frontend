import { useMemo, useState } from "react";
import { Link, generatePath } from "react-router-dom";
import { ArrowLeft, Search, UserPlus } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CLIENT_STATUS_LABEL,
  buildManagedClients,
  type ClientAccountStatus,
} from "@/lib/mypageseo/clients-data";
import {
  CLIENT_USERS_PAGE_SIZE,
  CLIENT_USER_STATUS_LABEL,
  CLIENT_USER_STATUS_TONE,
  getClientUsers,
  type ClientUser,
  type ClientUserRole,
} from "@/lib/mypageseo/client-users";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useRequiredParams } from "@/hooks/use-required-params";

const statusTone: Record<ClientAccountStatus, "success" | "warning" | "critical"> = {
  active: "success",
  setup_required: "warning",
  disconnected: "critical",
};



function ClientUsersPage() {
  const workspace = useWorkspace();
  const { clientId } = useRequiredParams("clientId");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const client = useMemo(
    () => buildManagedClients(workspace.clients, workspace.locations).find((row) => row.id === clientId) ?? null,
    [workspace.clients, workspace.locations, clientId],
  );

  const result = getClientUsers(clientId);

  if (workspace.status === "loading") {
    return (
      <AppShell>
        <PageHeader title="Client Users" description="Loading this client's access list." />
        <TableSkeleton rows={5} columns={5} />
      </AppShell>
    );
  }

  if (workspace.status === "unavailable") {
    return (
      <AppShell>
        <PageHeader title="Client Users" description="People with access to this client's workspace." />
        <ErrorState
          description="We couldn't load this client. Try again without leaving this page."
          onRetry={() => window.location.reload()}
        />
      </AppShell>
    );
  }

  if (workspace.organization?.accountType !== "agency") {
    return (
      <AppShell>
        <PageHeader title="Client Users" description="Client accounts are part of the Agency workspace." />
        <EmptyState
          title="Client access management is only available to agency organizations"
          description="This organization is a business account, so people are managed at the organization level instead of per client."
          action={
            <Button asChild>
              <Link to="/locations">Go to locations</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  if (!client) {
    return (
      <AppShell>
        <PageHeader title="Client not found" description="This client is not part of the current agency workspace." />
        <EmptyState
          title="We couldn't find this client"
          description="The client may have been removed, or it belongs to another agency organization."
          action={
            <Button asChild>
              <Link to="/clients">
                <ArrowLeft aria-hidden /> Back to clients
              </Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const capabilities = result.status === "loading" || result.status === "error" ? null : result.capabilities;
  const roles: ClientUserRole[] = result.status === "ready" || result.status === "no_users" ? result.roles : [];
  const users: ClientUser[] = result.status === "ready" ? result.users : [];

  const needle = query.trim().toLowerCase();
  const filtered = users.filter(
    (user) => !needle || `${user.name ?? ""} ${user.email}`.toLowerCase().includes(needle),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / CLIENT_USERS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * CLIENT_USERS_PAGE_SIZE, safePage * CLIENT_USERS_PAGE_SIZE);

  const roleLabel = (roleId: string | null) =>
    roles.find((role) => role.id === roleId)?.label ?? "—";

  return (
    <AppShell>
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/clients/${client.id}`}>
            <ArrowLeft aria-hidden /> Back to {client.name}
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Client Users"
        description={`Manage the people who have access to ${client.name}'s Mypageseo workspace, including their access level and status.`}
        meta={
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge tone={statusTone[client.status]}>{CLIENT_STATUS_LABEL[client.status]}</StatusBadge>
            <span>
              {client.locationCount} location{client.locationCount === 1 ? "" : "s"}
            </span>
          </div>
        }
        actions={
          capabilities?.canInvite ? (
            <Button size="sm">
              <UserPlus aria-hidden /> Invite user
            </Button>
          ) : null
        }
      />

      <nav aria-label="Client sections" className="mt-4 flex gap-1 overflow-x-auto border-b border-border">
        <ClientTab to="/clients/:clientId" clientId={client.id} label="Overview" />
        <ClientTab to="/clients/:clientId/locations" clientId={client.id} label="Locations" />
        <ClientTab to="/clients/:clientId/users" clientId={client.id} label="Users" active />
      </nav>

      <div className="mt-5 space-y-4">
        {result.status === "error" ? (
          <ErrorState description={result.message} onRetry={() => window.location.reload()} />
        ) : result.status === "unavailable" ? (
          <EmptyState
            title="Client user access is not available yet"
            description={result.reason}
            action={
              <Button asChild variant="outline">
                <Link to={`/clients/${client.id}`}>
                  Back to client overview
                </Link>
              </Button>
            }
          />
        ) : users.length === 0 ? (
          <EmptyState
            title={`No one has access to ${client.name} yet`}
            description="Client users can sign in to see this client's locations, rankings and reports. Invite someone to give them access."
            action={
              capabilities?.canInvite ? (
                <Button>
                  <UserPlus aria-hidden /> Invite user
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Panel title="People with access" description={`${filtered.length} of ${users.length} users`}>
            <div className="mb-3 relative max-w-md">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                aria-label="Search client users"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search name or email"
                className="h-9 pl-9"
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title="No users match this search"
                description="Try a different name or email address."
                action={
                  <Button variant="outline" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Access level</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell>{roleLabel(user.roleId)}</TableCell>
                          <TableCell>
                            <StatusBadge tone={CLIENT_USER_STATUS_TONE[user.status]}>
                              {CLIENT_USER_STATUS_LABEL[user.status]}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {user.lastActivity ? new Date(user.lastActivity).toLocaleDateString() : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <ul className="space-y-2 md:hidden">
                  {visible.map((user) => (
                    <li key={user.id} className="rounded-md border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{user.name ?? user.email}</p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <StatusBadge tone={CLIENT_USER_STATUS_TONE[user.status]}>
                          {CLIENT_USER_STATUS_LABEL[user.status]}
                        </StatusBadge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">Access: {roleLabel(user.roleId)}</p>
                    </li>
                  ))}
                </ul>

                {pageCount > 1 ? (
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">
                      Page {safePage} of {pageCount}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
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

        <p className="text-xs text-muted-foreground">
          Inviting people, changing access levels, assigning locations and removing access all require the agency
          account-management backend, which is not connected to this workspace yet, so those actions are not shown.
        </p>
      </div>
    </AppShell>
  );
}

function ClientTab({
  to,
  clientId,
  label,
  active,
}: {
  to: "/clients/:clientId" | "/clients/:clientId/locations" | "/clients/:clientId/users";
  clientId: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={generatePath(to, { clientId })}
      className={
        active
          ? "-mb-px border-b-2 border-primary px-3 py-2 text-sm font-semibold text-primary"
          : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
      }
    >
      {label}
    </Link>
  );
}

export default ClientUsersPage;
