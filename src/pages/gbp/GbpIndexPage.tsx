import { useEffect, useState } from "react";
import { Link2Off, LoaderCircle } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { ConnectGbpButton } from "@/components/gbp-audit/connect-gbp-button";
import { GbpOverviewContent } from "@/components/gbp-audit/gbp-overview";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
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
import { useGbp } from "@/lib/gbp/use-gbp";
import { useGbpDisconnect } from "@/lib/gbp/use-gbp-connect";
import { useWorkspace } from "@/lib/mypageseo/workspace";

function GbpOverviewPage() {
  const workspace = useWorkspace();
  const location = workspace.activeLocation ?? workspace.locations[0] ?? null;
  const { disconnect, disconnecting, error } = useGbpDisconnect();
  const gbp = useGbp();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [connectPromptOpen, setConnectPromptOpen] = useState(false);

  // Pop up the backend's "Please connect with Google Business Profile" message when it arrives.
  useEffect(() => {
    if (gbp.notConnectedMessage) setConnectPromptOpen(true);
  }, [gbp.notConnectedMessage]);
console.log(location,"location")
  // Connection state comes from `GET gbp`; profile details still use the overview adapter.
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
  const canDisconnect = data?.status === "ready";

  const handleDisconnect = async () => {
    if (await disconnect()) setConfirmOpen(false);
  };
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
              {gbp.connected && gbp.account ? ` · Google: ${gbp.account}` : ""}
            </p>
          ) : undefined
        }
        actions={
          canDisconnect ? (
            <Button variant="outline" size="sm" disabled={disconnecting} onClick={() => setConfirmOpen(true)}>
              {disconnecting ? <LoaderCircle aria-hidden className="animate-spin" /> : <Link2Off aria-hidden />}
              {disconnecting ? "Disconnecting…" : "Disconnect Google"}
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

      <Dialog open={connectPromptOpen} onOpenChange={setConnectPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Google Business Profile not connected</DialogTitle>
            <DialogDescription>{gbp.notConnectedMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConnectPromptOpen(false)}>
              Not now
            </Button>
            <ConnectGbpButton />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!disconnecting) setConfirmOpen(open);
        }}
        title="Disconnect Google Business Profile?"
        description={
          error ??
          "Mypageseo will stop reading profile details, reviews and posts from Google. Existing history stays, but nothing new will sync until you reconnect."
        }
        cancelLabel="Keep connected"
        confirmLabel={disconnecting ? "Disconnecting…" : "Disconnect"}
        pending={disconnecting}
        onConfirm={() => void handleDisconnect()}
      />
    </AppShell>
  );
}

export default GbpOverviewPage;
