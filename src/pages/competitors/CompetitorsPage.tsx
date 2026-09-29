import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { CompetitorsContent } from "@/components/competitor/competitors";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { getCompetitors } from "@/lib/competitors/competitors";
import { useWorkspace } from "@/lib/mypageseo/workspace";



function CompetitorsPage() {
  const workspace = useWorkspace();
  const location = workspace.activeLocation ?? workspace.locations[0] ?? null;
  const data = location ? getCompetitors(location.id) : null;

  return (
    <AppShell>
      <PageHeader
        title="Competitors"
        description="Competitive position and measurable gaps."
        meta={
          location ? (
            <p className="text-xs text-muted-foreground">
              {location.businessName} · {location.area}
              {data?.lastCheckedAt ? ` · Last updated ${data.lastCheckedAt}` : ""}
            </p>
          ) : undefined
        }
      />
      {location && data ? (
        <CompetitorsContent data={data} locationId={location.id} onRetry={() => window.location.reload()} />
      ) : (
        <EmptyState
          title="No locations in this workspace"
          description="Add a location so ranking-based competitor data can be shown."
        />
      )}
    </AppShell>
  );
}

export default CompetitorsPage;
