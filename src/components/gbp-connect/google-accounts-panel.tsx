import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Link2, Link2Off, ListChecks, RefreshCw } from "lucide-react";
import type { GbpConnection } from "@/api";
import { Panel } from "@/components/layout/shared/data-display";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGbpConnections } from "@/lib/gbp/use-gbp";
import { useGbpConnect, useGbpDisconnect } from "@/lib/gbp/use-gbp-connect";
import { cn } from "@/lib/utils";

/**
 * Connected Google accounts (`GET gbp/connections`): pick more profiles from one, reconnect a
 * revoked one, or disconnect it. Shown on the Locations page and in Settings › Integrations.
 */
export function GoogleAccountsPanel({ className }: { className?: string }) {
  const { connections, limit, isPending, isError, refetch } = useGbpConnections();
  const { connect } = useGbpConnect();
  const { disconnect, disconnecting } = useGbpDisconnect();
  const [target, setTarget] = useState<GbpConnection | null>(null);
  const atLimit = connections.length >= limit;

  return (
    <Panel
      icon={KeyRound}
      tone="gbp"
      title="Google accounts"
      description={`The Google accounts that manage your Business Profiles (up to ${limit}).`}
      className={className}
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => connect()}
          title={atLimit ? "Disconnect an account to connect another, or sign in again to refresh one." : undefined}
        >
          <Link2 aria-hidden /> Connect Google account
        </Button>
      }
    >
      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          The connected Google accounts couldn't be loaded.
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : connections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No Google account is connected yet. Connect the one that manages your Business Profiles to add them as locations, with their reviews, posts and
          profile insights.
        </p>
      ) : (
        <ul className="-m-4 divide-y divide-border">
          {connections.map((connection) => {
            const revoked = connection.status === "revoked";
            return (
              <li key={connection.google_sub} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold uppercase ring-1 ring-inset",
                      revoked ? "bg-critical-surface text-critical ring-critical/25" : "bg-brand-tint text-primary ring-primary/20",
                    )}
                  >
                    {connection.google_email.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                      <span className="truncate">{connection.google_email}</span>
                      <StatusBadge tone={revoked ? "critical" : "success"} size="sm" dot>
                        {revoked ? "Reconnect needed" : "Connected"}
                      </StatusBadge>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {connection.bound} {connection.bound === 1 ? "location" : "locations"} added · {connection.picked} ready to add
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 pl-12 sm:pl-0">
                  {revoked ? (
                    <Button size="sm" onClick={() => connect()}>
                      <RefreshCw aria-hidden /> Reconnect
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => connect({ googleSub: connection.google_sub, googleEmail: connection.google_email })}>
                      <ListChecks aria-hidden /> Choose profiles
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={disconnecting} onClick={() => setTarget(connection)}>
                    <Link2Off aria-hidden /> Disconnect
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !disconnecting) setTarget(null);
        }}
        title={`Disconnect ${target?.google_email ?? "this Google account"}?`}
        description={
          target ? (
            <span className="block space-y-2 text-left">
              {/* This warning's wording is fixed by the backend contract: keep it exact. */}
              <span className="block font-medium text-critical">
                All the data and locations related to this Google account will be removed if disconnected.
              </span>
              {target.locations && target.locations.length > 0 ? (
                <span className="block">
                  {target.locations.length === 1 ? "This location will be removed:" : `These ${target.locations.length} locations will be removed:`}
                  <span className="mt-1 block max-h-40 overflow-y-auto rounded-md border border-border bg-surface-strong px-3 py-2">
                    {target.locations.map((location) => (
                      <span key={location.location_id} className="block text-foreground">
                        {location.name}
                      </span>
                    ))}
                  </span>
                </span>
              ) : (
                <span className="block">No locations are connected through this Google account.</span>
              )}
              {target.picked > 0 ? (
                <span className="block">
                  {target.picked} picked profile{target.picked === 1 ? "" : "s"} waiting to be added will be removed too.
                </span>
              ) : null}
              <span className="block">Your other Google accounts and their locations keep working.</span>
            </span>
          ) : (
            ""
          )
        }
        cancelLabel="Keep connected"
        confirmLabel={disconnecting ? "Disconnecting…" : target?.locations?.length ? "Disconnect and remove" : "Disconnect"}
        pending={disconnecting}
        onConfirm={() => {
          if (!target) return;
          const { google_sub: googleSub, google_email: email } = target;
          setTarget(null);
          void disconnect(googleSub).then((result) => {
            if (!result) {
              toast.error(`${email} could not be disconnected. Try again.`);
              return;
            }
            const removed = result.locations_removed ?? [];
            toast.success(`${email} disconnected`, {
              description: removed.length > 0 ? `Removed ${removed.length === 1 ? removed[0]!.name : `${removed.length} locations`}.` : undefined,
            });
          });
        }}
      />
    </Panel>
  );
}
