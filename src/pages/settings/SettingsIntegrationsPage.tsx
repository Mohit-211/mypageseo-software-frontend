import { useMemo, useState } from "react";
import { RequireAccess } from "@/components/mypageseo/access";
import { Link } from "react-router-dom";
import { AlertTriangle, ExternalLink, Link2, Link2Off, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel, SectionHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { SettingsNav } from "@/components/settings/settings-nav";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import {
  CONNECTION_LABEL,
  CONNECTION_TONE,
  countByState,
  getIntegrations,
  maskAccount,
  type GoogleIntegration,
  type LocationConnection,
} from "@/lib/mypageseo/integrations";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useGbpConnect, useGbpDisconnect } from "@/lib/gbp/use-gbp-connect";

const SettingsIntegrationsPage = () => (
    <RequireAccess permission="integrations.manage">
      <IntegrationsSettingsPage />
    </RequireAccess>
  );

const DESCRIPTION = "Manage the external services connected to Mypageseo.";

function IntegrationsSettingsPage() {
  const workspace = useWorkspace();
  const accountType = workspace.organization?.accountType ?? "business";
  const isAgency = accountType === "agency";
  const result = getIntegrations(accountType, workspace.activeClient?.id ?? null);

  return (
    <AppShell>
      <PageHeader title="Integrations" description={DESCRIPTION} />
      <SettingsNav active="integrations" isAgency={isAgency} />

      {result.status === "loading" ? (
        <TableSkeleton rows={4} columns={4} />
      ) : result.status === "error" ? (
        <ErrorState description={result.message} onRetry={() => window.location.reload()} />
      ) : result.status === "unavailable" ? (
        <EmptyState title="Integrations are unavailable" description={result.reason} />
      ) : (
        <GoogleIntegrationSection integration={result.google} isAgency={isAgency} />
      )}
    </AppShell>
  );
}

function GoogleIntegrationSection({
  integration,
  isAgency,
}: {
  integration: GoogleIntegration;
  isAgency: boolean;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<LocationConnection | null>(null);
  const [confirmOrgDisconnect, setConfirmOrgDisconnect] = useState(false);
  const [organizationState, setOrganizationState] = useState(integration.organizationState);
  const [notice, setNotice] = useState<string | null>(null);
  const { connect, connecting, error: connectError } = useGbpConnect();
  const { disconnect, disconnecting, error: disconnectError } = useGbpDisconnect();
  const { locations, capabilities } = integration;

  const counts = useMemo(
    () => ({
      connected: countByState(locations, "connected"),
      reconnect: countByState(locations, "reconnect_required"),
      disconnected: countByState(locations, "disconnected"),
      notConfigured: countByState(locations, "not_configured"),
    }),
    [locations],
  );

  const needsAttention = locations.filter(
    (location) => location.state === "reconnect_required" || location.state === "disconnected",
  );

  const runAction = (id: string, message: string) => {
    setPending(id);
    setActionError(null);
    window.setTimeout(() => {
      setPending(null);
      setActionError(message);
    }, 400);
  };

  const unsupportedNote =
    "Disconnecting a single location isn't available yet. Use Disconnect above to revoke Google access for the workspace.";

  const handleOrgDisconnect = async () => {
    setNotice(null);
    if (await disconnect()) {
      setConfirmOrgDisconnect(false);
      setOrganizationState("disconnected");
      setNotice("Google Business Profile disconnected. Reconnect any time to resume syncing.");
    }
  };

  const orgConnected = organizationState === "connected";
  const statusMessage = connectError ?? disconnectError ?? actionError;

  return (
    <div className="space-y-6">
      <section aria-labelledby="google-integration">
        <SectionHeader
          title="Connected services"
          description="Only services Mypageseo supports today are listed here"
        />
        <Panel className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 id="google-integration" className="text-sm font-semibold text-foreground">
                  {integration.name}
                </h3>
                <StatusBadge tone={CONNECTION_TONE[organizationState]}>
                  {CONNECTION_LABEL[organizationState]}
                </StatusBadge>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{integration.purpose}</p>
              {orgConnected && integration.organizationAccount ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Organization account:{" "}
                  <span className="font-medium text-foreground">
                    {maskAccount(integration.organizationAccount)}
                  </span>
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {orgConnected ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!capabilities.canReconnect || connecting}
                    onClick={() => void connect()}
                  >
                    <RefreshCw aria-hidden className={connecting ? "animate-spin" : undefined} />
                    {connecting ? "Redirecting…" : "Reconnect"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!capabilities.canDisconnect || disconnecting}
                    onClick={() => setConfirmOrgDisconnect(true)}
                  >
                    <Link2Off aria-hidden /> Disconnect
                  </Button>
                </>
              ) : (
                <Button size="sm" disabled={!capabilities.canConnect || connecting} onClick={() => void connect()}>
                  <Link2 aria-hidden /> {connecting ? "Redirecting to Google…" : "Connect Google"}
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface-strong p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What Mypageseo uses this for
            </p>
            <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
              {integration.usedFor.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-muted-foreground">
            Google access is granted per location. A linked organization account does not connect every
            location on its own — each location must be matched to its Google Business Profile below.
          </p>

          {notice ? (
            <p role="status" className="text-sm text-success">
              {notice}
            </p>
          ) : null}

          {statusMessage ? (
            <p role="alert" className="text-sm text-warning-foreground">
              {statusMessage}
            </p>
          ) : null}
        </Panel>
      </section>

      {needsAttention.length > 0 ? (
        <Panel className="border-l-4 border-l-warning">
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {needsAttention.length} location{needsAttention.length === 1 ? " needs" : "s need"} Google
                access restored
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Profile, review and post data stops updating for these locations until access is restored.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      <section aria-labelledby="location-connections">
        <SectionHeader
          title="Location connections"
          description={`${counts.connected} connected · ${counts.reconnect} need reconnect · ${counts.disconnected} disconnected · ${counts.notConfigured} not connected`}
        />

        {locations.length === 0 ? (
          <EmptyState
            title="No locations to connect"
            description="Add a location first, then match it to its Google Business Profile."
            action={
              <Button asChild size="sm">
                <Link to="/locations/add">Add location</Link>
              </Button>
            }
          />
        ) : (
          <Panel className="p-0">
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-border bg-surface-strong text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Location</th>
                  {isAgency ? <th className="px-4 py-2.5 font-semibold">Client</th> : null}
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Google account</th>
                  <th className="px-4 py-2.5 font-semibold">Last sync</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((location) => (
                  <tr key={location.locationId} className="border-b border-border last:border-b-0 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{location.locationName}</p>
                      <p className="text-xs text-muted-foreground">{location.area}</p>
                      {location.issue ? (
                        <p className="mt-1 max-w-md text-xs text-muted-foreground">{location.issue}</p>
                      ) : null}
                    </td>
                    {isAgency ? (
                      <td className="px-4 py-3 text-muted-foreground">{location.clientName ?? "—"}</td>
                    ) : null}
                    <td className="px-4 py-3">
                      <StatusBadge tone={CONNECTION_TONE[location.state]}>
                        {CONNECTION_LABEL[location.state]}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {maskAccount(location.account) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatSync(location.lastSync)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <ConnectionActions
                          location={location}
                          capabilities={integration.capabilities}
                          pending={pending}
                          connecting={connecting}
                          onConnect={() => void connect()}
                          onDisconnect={setDisconnectTarget}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile rows */}
            <ul className="divide-y divide-border md:hidden">
              {locations.map((location) => (
                <li key={location.locationId} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{location.locationName}</p>
                      <p className="text-xs text-muted-foreground">
                        {isAgency && location.clientName ? `${location.clientName} · ` : ""}
                        {location.area}
                      </p>
                    </div>
                    <StatusBadge tone={CONNECTION_TONE[location.state]}>
                      {CONNECTION_LABEL[location.state]}
                    </StatusBadge>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Google account</dt>
                      <dd className="text-foreground">{maskAccount(location.account) ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Last sync</dt>
                      <dd className="text-foreground">{formatSync(location.lastSync)}</dd>
                    </div>
                  </dl>
                  {location.issue ? (
                    <p className="text-xs text-muted-foreground">{location.issue}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <ConnectionActions
                      location={location}
                      capabilities={integration.capabilities}
                      pending={pending}
                      connecting={connecting}
                          onConnect={() => void connect()}
                      onDisconnect={setDisconnectTarget}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>

      <ConfirmDialog
        open={confirmOrgDisconnect}
        onOpenChange={(open) => {
          if (!disconnecting) setConfirmOrgDisconnect(open);
        }}
        title="Disconnect Google Business Profile?"
        description={
          disconnectError ??
          "Mypageseo will stop reading profile details, reviews and posts for every location linked to this Google account. Existing history stays, but nothing new will sync until you reconnect."
        }
        cancelLabel="Keep connected"
        confirmLabel={disconnecting ? "Disconnecting…" : "Disconnect"}
        pending={disconnecting}
        onConfirm={() => void handleOrgDisconnect()}
      />

      <ConfirmDialog
        open={disconnectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDisconnectTarget(null);
        }}
        title="Disconnect Google access?"
        description={
          disconnectTarget
            ? `Mypageseo will stop reading profile details, reviews and posts for ${disconnectTarget.locationName}. Existing history stays, but nothing new will sync until the location is reconnected.`
            : ""
        }
        cancelLabel="Keep connected"
        confirmLabel="Disconnect"
        onConfirm={() => {
          const target = disconnectTarget;
          setDisconnectTarget(null);
          if (target) runAction(target.locationId, unsupportedNote);
        }}
      />
    </div>
  );
}

function ConnectionActions({
  location,
  capabilities,
  pending,
  connecting,
  onConnect,
  onDisconnect,
}: {
  location: LocationConnection;
  capabilities: GoogleIntegration["capabilities"];
  pending: string | null;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: (location: LocationConnection) => void;
}) {
  const busy = pending === location.locationId;

  if (location.state === "connected") {
    return (
      <div className="flex flex-wrap gap-2">
        {capabilities.canManage ? (
          <Button asChild variant="outline" size="sm">
            <Link to={`/locations/${location.locationId}/gbp`}>
              <ExternalLink aria-hidden /> Manage
            </Link>
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          disabled={!capabilities.canDisconnect || busy}
          onClick={() => onDisconnect(location)}
        >
          <Link2Off aria-hidden /> Disconnect
        </Button>
      </div>
    );
  }

  if (location.state === "not_configured") {
    return (
      <Button
        size="sm"
        disabled={!capabilities.canConnect || busy || connecting}
        onClick={onConnect}
      >
        <Link2 aria-hidden /> {connecting ? "Redirecting…" : "Connect"}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      disabled={!capabilities.canReconnect || busy || connecting}
      onClick={onConnect}
    >
      <RefreshCw aria-hidden /> {connecting ? "Redirecting…" : "Reconnect"}
    </Button>
  );
}

function formatSync(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default SettingsIntegrationsPage;
