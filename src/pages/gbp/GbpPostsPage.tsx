import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { GbpPostsContent } from "@/components/gbp-audit/gbp-posts";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { getGbpPosts } from "@/lib/mypageseo/gbp-posts";
import { useWorkspace } from "@/lib/mypageseo/workspace";



function GbpPostsPage() {
  const workspace = useWorkspace();
  const location = workspace.activeLocation ?? workspace.locations[0] ?? null;
  const data = location ? getGbpPosts(location?.id) : null;

  return (
    <AppShell>
      <PageHeader
        title="Posts"
        description="Scheduled and published GBP posts."
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
        <GbpPostsContent data={data} onRetry={() => window.location.reload()} />
      ) : (
        <EmptyState
          title="No locations in this workspace"
          description="Add a location to this workspace to draft and publish posts."
        />
      )}
    </AppShell>
  );
}

export default GbpPostsPage;
