import { useState } from "react";
import { toast } from "sonner";
import { Link2, Link2Off, ListChecks, RefreshCw } from "lucide-react";
import type { GbpConnection } from "@/api";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGbpConnections } from "@/lib/gbp/use-gbp";
import { useGbpConnect, useGbpDisconnect } from "@/lib/gbp/use-gbp-connect";

/** Connected Google accounts (`GET gbp/connections`) with reconnect, pick and disconnect. */
export function GoogleAccountsPanel({ className }: { className?: string }) {
  const { connections, limit, isPending, isError, refetch } = useGbpConnections();
  const { connect } = useGbpConnect();
  const { disconnect, disconnecting } = useGbpDisconnect();
  const [target, setTarget] = useState<GbpConnection | null>(null);
  const atLimit = connections.length >= limit;

  return (
    <Panel
      title="Google accounts"
      description={`Up to ${limit} Google accounts can be connected.`}
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
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          Connected Google accounts could not be loaded.
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : connections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No Google account is connected. Connect one to pick the Business Profiles you want to track.
        </p>
      ) : (
        <ul className="-m-4 divide-y divide-border">
          {connections.map((connection) => {
            const revoked = connection.status === "revoked";
            return (
              <li
                key={connection.google_sub}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    <span className="truncate">{connection.google_email}</span>
                    <StatusBadge tone={revoked ? "critical" : "success"}>
                      {revoked ? "Reconnect needed" : "Active"}
                    </StatusBadge>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {connection.bound} bound · {connection.picked} waiting to bind
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {revoked ? (
                    <Button size="sm" onClick={() => connect()}>
                      <RefreshCw aria-hidden /> Reconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        connect({ googleSub: connection.google_sub, googleEmail: connection.google_email })
                      }
                    >
                      <ListChecks aria-hidden /> Choose locations
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disconnecting}
                    onClick={() => setTarget(connection)}
                  >
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
          "Its locations stay in Mypageseo but stop syncing Google Business Profile data, and its picked locations are removed. Your other Google accounts keep working."
        }
        cancelLabel="Keep connected"
        confirmLabel={disconnecting ? "Disconnecting…" : "Disconnect"}
        pending={disconnecting}
        onConfirm={() => {
          if (!target) return;
          const { google_sub: googleSub, google_email: email } = target;
          setTarget(null);
          void disconnect(googleSub).then((ok) => {
            if (ok) toast.success(`${email} disconnected`);
            else toast.error(`${email} could not be disconnected. Try again.`);
          });
        }}
      />
    </Panel>
  );
}
