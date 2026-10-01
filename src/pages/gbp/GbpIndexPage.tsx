import { useState } from "react";
import { Link } from "react-router-dom";
import { Settings2 } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { GbpOverviewContent } from "@/components/gbp-audit/gbp-overview";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getGbpOverview } from "@/lib/gbp/gbp-overview";
import { useGbpConnections } from "@/lib/gbp/use-gbp";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { useWorkspace } from "@/lib/mypageseo/workspace";

function GbpOverviewPage() {
  const workspace = useWorkspace();
  const location = workspace.activeLocation ?? workspace.locations[0] ?? null;
  const gbp = useGbpConnections();
  const { connect } = useGbpConnect();
  const [promptDismissed, setPromptDismissed] = useState(false);
  // Prompt to connect once we know no Google account is usable.
  const connectPromptOpen = gbp.isSuccess && !gbp.connected && !promptDismissed;
  const accounts = gbp.connections
    .filter((connection) => connection.status === "active")
    .map((connection) => connection.google_email)
    .join(", ");

console.log(location,"location")
  // Connection state comes from `GET gbp/connections`; profile details still use the overview adapter.
  const overview = location ? getGbpOverview(location.id) : null;
  const data = overview
    ? gbp.isPending
      ? { ...overview, status: "loading" as const }
      : gbp.isError
        ? { ...overview, status: "error" as const }
        : gbp.connected
          ? overview
          : { ...overview, status: "disconnected" as const }
    : null;
console.log(data,"data")
  return (
    <AppShell>
      <PageHeader
        title="GBP Overview"
        description="Google Business Profile health and activity."
        meta={
          location ? (
            <p className="text-xs text-muted-foreground">
              {location.businessName} · {location.area}
              {gbp.connected && accounts ? ` · Google: ${accounts}` : ""}
            </p>
          ) : undefined
        }
        actions={
          gbp.connected ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/locations">
                <Settings2 aria-hidden /> Manage Google accounts
              </Link>
            </Button>
          ) : undefined
        }
      />
      {location && data ? (
        <GbpOverviewContent data={data} onRetry={() => void gbp.refetch()} />
      ) : (
        <EmptyState
          title="No locations in this workspace"
          description="Add a location to this workspace to see its Google Business Profile overview."
        />
      )}

      <Dialog open={connectPromptOpen} onOpenChange={(open) => setPromptDismissed(!open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Google Business Profile not connected</DialogTitle>
            <DialogDescription>
              Connect a Google account and pick your Business Profile locations to see their data here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPromptDismissed(true)}>
              Not now
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setPromptDismissed(true);
                connect();
              }}
            >
              Connect Google
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppShell>
  );
}

export default GbpOverviewPage;
