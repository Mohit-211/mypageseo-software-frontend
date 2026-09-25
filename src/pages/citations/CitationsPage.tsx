import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { CitationsContent } from "@/components/citation/citations";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { getCitations } from "@/lib/mypageseo/citations";
import { useWorkspace } from "@/lib/mypageseo/workspace";



function CitationsPage() {
  const workspace = useWorkspace();
  const location = workspace.activeLocation ?? workspace.locations[0] ?? null;
  const data = location ? getCitations(location.id) : null;

  return (
    <AppShell>
      <PageHeader
        title="Citations"
        description="Directory listings and NAP consistency."
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
        <CitationsContent data={data} locationId={location.id} onRetry={() => window.location.reload()} />
      ) : (
        <EmptyState
          title="No locations in this workspace"
          description="Add a location to this workspace to see citation health."
        />
      )}
    </AppShell>
  );
}

export default CitationsPage;
