import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPinPlus } from "lucide-react";
import { AppShell } from "@/components/mypageseo/app-shell";
import {
  MetricCard,
  PageHeader,
  Panel,
  SectionHeader,
  StatusBadge,
} from "@/components/mypageseo/data-display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/mypageseo/states";
import { LocationsTable, type LocationSort, type SortOrder } from "@/components/mypageseo/locations-table";
import { Button } from "@/components/ui/button";
import {
  CLIENT_STATUS_LABEL,
  buildManagedClients,
  getClientCapabilities,
  type ClientAccountStatus,
} from "@/lib/mypageseo/clients-data";
import { buildManagedLocations } from "@/lib/mypageseo/locations-data";
import { getReports } from "@/lib/mypageseo/reports";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useRequiredParams } from "@/hooks/use-required-params";

const statusTone: Record<ClientAccountStatus, "success" | "warning" | "critical"> = {
  active: "success",
  setup_required: "warning",
  disconnected: "critical",
};

const PAGE_SIZE = 10;



function ClientDetailPage() {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const { clientId } = useRequiredParams("clientId");
  const capabilities = getClientCapabilities();
  const [sort, setSort] = useState<LocationSort>("location");
  const [order, setOrder] = useState<SortOrder>("asc");
  const [page, setPage] = useState(1);

  const client = useMemo(
    () => buildManagedClients(workspace.clients, workspace.locations).find((row) => row.id === clientId) ?? null,
    [workspace.clients, workspace.locations, clientId],
  );

  const locations = useMemo(
    () =>
      buildManagedLocations(workspace.locations, workspace.clients).filter(
        (location) => location.clientId === clientId,
      ),
    [workspace.locations, workspace.clients, clientId],
  );

  const sorted = useMemo(() => {
    const direction = order === "asc" ? 1 : -1;
    return [...locations].sort((a, b) => {
      const pick = (row: (typeof locations)[number]) =>
        sort === "visibility"
          ? row.visibility
          : sort === "gbp"
            ? row.gbpHealth
            : sort === "reviews"
              ? (row.reviewCount ?? null)
              : sort === "rank"
                ? row.averageRank
                : sort === "status"
                  ? row.status
                  : row.businessName;
      const left = pick(a);
      const right = pick(b);
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      return direction * (typeof left === "string" ? left.localeCompare(String(right)) : left - Number(right));
    });
  }, [locations, sort, order]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const reports = getReports();

  if (workspace.status === "loading") {
    return (
      <AppShell>
        <PageHeader title="Client" description="Loading this client account." />
        <TableSkeleton rows={6} columns={7} />
      </AppShell>
    );
  }

  if (workspace.status === "unavailable") {
    return (
      <AppShell>
        <PageHeader title="Client" description="Agency client account." />
        <ErrorState
          description="We couldn't load this client account. Try again without leaving this page."
          onRetry={() => window.location.reload()}
        />
      </AppShell>
    );
  }

  if (workspace.organization?.accountType !== "agency") {
    return (
      <AppShell>
        <PageHeader title="Client" description="Client accounts are part of the Agency workspace." />
        <EmptyState
          title="Client accounts are only available to agency organizations"
          description="This organization is a business account, so its locations are managed directly instead of through client accounts."
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

  return (
    <AppShell>
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/clients">
            <ArrowLeft aria-hidden /> Back to clients
          </Link>
        </Button>
      </div>

      <PageHeader
        title={client.name}
        description="Client-level overview of the locations, profile health and reporting Mypageseo manages for this account."
        meta={
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge tone={statusTone[client.status]}>{CLIENT_STATUS_LABEL[client.status]}</StatusBadge>
            <span>
              {client.locationCount} location{client.locationCount === 1 ? "" : "s"}
            </span>
            {client.needsAttention > 0 ? (
              <span className="text-critical">{client.needsAttention} need setup</span>
            ) : null}
          </div>
        }
        actions={
          <>
            {capabilities.canEdit ? (
              <Button variant="outline" size="sm">
                Edit client
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link to={`/clients/${client.id}/users`}>
                Client users
              </Link>
            </Button>
            <Button size="sm" onClick={() => navigate("/locations/add")}>
              <MapPinPlus aria-hidden /> Add location
            </Button>
          </>
        }
      />

      <div className="mt-5 space-y-6">
        <section>
          <SectionHeader
            title="Account summary"
            description="Aggregated from the locations assigned to this client. Metrics without a source are shown as unavailable."
          />
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Locations" value={String(client.locationCount)} caption="Assigned to this client" />
            <MetricCard
              label="Visibility"
              value={client.visibility === null ? "—" : String(client.visibility)}
              caption="Average across reporting locations"
            />
            <MetricCard
              label="GBP health"
              value={client.gbpHealth === null ? "—" : String(client.gbpHealth)}
              caption="Average profile health"
            />
            <MetricCard
              label="Reviews"
              value={client.averageRating === null ? "—" : client.averageRating.toFixed(1)}
              caption={client.reviewCount === null ? "No review data" : `${client.reviewCount} reviews total`}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Citation health, report status and client activity are supplied by services that are not connected to this
            frontend yet, so they are not shown here.
          </p>
        </section>

        <section>
          <SectionHeader
            title="Locations"
            description="Every location assigned to this client. Open a location to work inside its rankings, GBP and citations."
            actions={
              <Button asChild variant="outline" size="sm">
                <Link to={`/clients/${client.id}/locations`}>
                  Manage locations
                </Link>
              </Button>
            }
          />
          {locations.length === 0 ? (
            <EmptyState
              title="No locations assigned to this client"
              description="Connect a Google Business Profile location and assign it to this client to start tracking local performance."
              action={
                <Button onClick={() => navigate("/locations/add")}>
                  <MapPinPlus aria-hidden /> Add location
                </Button>
              }
            />
          ) : (
            <LocationsTable
              locations={visible}
              agency
              sort={sort}
              order={order}
              page={safePage}
              pageCount={pageCount}
              onSort={(next) => {
                setOrder(sort === next && order === "asc" ? "desc" : "asc");
                setSort(next);
                setPage(1);
              }}
              onPageChange={setPage}
              onOpen={(location) => {
                workspace.setActiveClientId(client.id);
                workspace.setActiveLocationId(location.id);
                navigate(`/locations/${location.id}/rankings`);
              }}
            />
          )}
        </section>

        <section>
          <SectionHeader
            title="Reports"
            description="Reports generated for this client."
            actions={
              <Button asChild variant="outline" size="sm">
                <Link to="/reports">Reports center</Link>
              </Button>
            }
          />
          <Panel className="p-4">
            {reports.status === "no_reports" || reports.reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No reports have been generated for this client. Reporting is managed from the Reports Center.
              </p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {reports.reports
                  .filter((report) => report.clientId === client.id)
                  .map((report) => (
                    <li key={report.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="truncate text-foreground">{report.name}</span>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/reports/${report.id}`}>
                          View
                        </Link>
                      </Button>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>
        </section>
      </div>
    </AppShell>
  );
}

export default ClientDetailPage;
