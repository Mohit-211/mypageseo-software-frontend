import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { GbpOverviewContent } from "@/components/gbp-audit/gbp-overview";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { getGbpOverview } from "@/lib/gbp/gbp-overview";
import { useWorkspace } from "@/lib/mypageseo/workspace";



function GbpOverviewPage() {
  const workspace = useWorkspace();
  const location = workspace.activeLocation ?? workspace.locations[0] ?? null;

  return (
    <AppShell>
      <PageHeader
        title="GBP Overview"
        description="Google Business Profile health and activity."
        meta={location ? <p className="text-xs text-muted-foreground">{location.businessName} · {location.area}</p> : undefined}
      />
      {location ? (
        <GbpOverviewContent data={getGbpOverview(location?.id)} onRetry={() => window.location.reload()} />
      ) : (
        <EmptyState
          title="No locations in this workspace"
          description="Add a location to this workspace to see its Google Business Profile overview."
        />
      )}
    </AppShell>
  );
}

export default GbpOverviewPage;
