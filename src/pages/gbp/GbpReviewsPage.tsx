import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { GbpReviewsContent } from "@/components/gbp-audit/gbp-reviews";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { getGbpReviews } from "@/lib/mypageseo/gbp-reviews";
import { useWorkspace } from "@/lib/mypageseo/workspace";



function GbpReviewsPage() {
  const workspace = useWorkspace();
  const location = workspace.activeLocation ?? workspace.locations[0] ?? null;
  const data = location ? getGbpReviews(location?.id) : null;

  return (
    <AppShell>
      <PageHeader
        title="Reviews"
        description="Reviews and response workflow for the location."
        meta={
          location ? (
            <p className="text-xs text-muted-foreground">
              {location.businessName} · {location.area}
              {data?.lastCheckedAt ? ` · Last checked ${data.lastCheckedAt}` : ""}
            </p>
          ) : undefined
        }
      />
      {location && data ? (
        <GbpReviewsContent data={data} onRetry={() => window.location.reload()} />
      ) : (
        <EmptyState
          title="No locations in this workspace"
          description="Add a location to this workspace to see its reviews."
        />
      )}
    </AppShell>
  );
}

export default GbpReviewsPage;
