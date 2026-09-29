import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Info } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import {
  BusinessProfileSelector,
  GoogleBusinessConnection,
  LocationConfirmation,
  type GoogleBusinessProfile,
  type GoogleConnectionState,
} from "@/components/location/location-setup";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { PlanLimitNotice, PlanLimitPanel, usePlanLimit } from "@/components/mypageseo/plan";
import { planLimitMessage } from "@/lib/mypageseo/plan";



function AddLocationPage() {
  const workspace = useWorkspace();
  const agency = workspace.organization?.accountType === "agency";
  const [connectionState, setConnectionState] = useState<GoogleConnectionState>("disconnected");
  const [profiles] = useState<GoogleBusinessProfile[]>([]);
  const [query, setQuery] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<GoogleBusinessProfile | null>(null);
  const [clientId, setClientId] = useState(workspace.activeClient?.id ?? "");
  const locationLimit = usePlanLimit("locations");

  const connect = () => {
    setConnectionState("connecting");
    window.setTimeout(() => setConnectionState("error"), 700);
  };

  const canComplete = Boolean(selectedProfile && (!agency || clientId));

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/locations"><ArrowLeft aria-hidden /> Back to locations</Link>
        </Button>

        <PageHeader
          title="Add a location"
          description="A location represents a Google Business Profile that Mypageseo manages and analyzes for local search performance."
        />

        {locationLimit?.reached ? (
          <PlanLimitPanel
            title="Your plan's locations are all in use"
            description={planLimitMessage(locationLimit)}
          />
        ) : (
          <>
        {locationLimit ? <PlanLimitNotice state={locationLimit} /> : null}

        <GoogleBusinessConnection state={connectionState} onConnect={connect} onRetry={connect} />

        {connectionState === "connected" ? (
          <div className="space-y-5">
            {agency ? (
              <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
                <Label htmlFor="client" className="text-sm font-semibold text-foreground">Client</Label>
                <p className="mt-1 text-xs text-muted-foreground">Choose the client that will own this location.</p>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger id="client" className="mt-3 max-w-sm bg-background" aria-label="Location client"><SelectValue placeholder="Select a client" /></SelectTrigger>
                  <SelectContent>{workspace.clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                </Select>
              </section>
            ) : null}

            <BusinessProfileSelector profiles={profiles} query={query} {...(selectedProfile ? { selectedId: selectedProfile.id } : {})} onQueryChange={setQuery} onSelect={setSelectedProfile} />
            {selectedProfile ? <LocationConfirmation profile={selectedProfile} /> : null}

            <Alert>
              <Info aria-hidden />
              <AlertDescription>After the location is connected, keyword, competitor and ranking collection setup can continue separately.</AlertDescription>
            </Alert>

            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-background/95 py-4 sm:flex-row sm:items-center sm:justify-end">
              <Button asChild variant="outline"><Link to="/locations">Cancel</Link></Button>
              <Button disabled={!canComplete}><CheckCircle2 aria-hidden /> Add location</Button>
            </div>
          </div>
        ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}

export default AddLocationPage;
