import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { CitationsContent, CitationsError, CitationsLoading, CitationsSettingUp } from "@/components/citation/citations";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { useCitations } from "@/lib/citations/use-citations";
import { useWorkspace } from "@/lib/mypageseo/workspace";

/** Citations for the location picked in the workspace switcher. */
function CitationsPage() {
  const workspace = useWorkspace();
  const location = workspace.activeLocation ?? workspace.locations[0] ?? null;

  return (
    <AppShell>
      <PageHeader
        title="Citations"
        description="Your directory listings, checked by hand by the MyPageSEO team."
        meta={location ? <p className="text-xs text-muted-foreground">{location.businessName} · {location.area}</p> : undefined}
      />
      {location ? (
        <LocationCitations locationId={location.id} />
      ) : (
        <EmptyState
          title="No locations in this workspace"
          description="Add a location to this workspace to see citation health."
        />
      )}
    </AppShell>
  );
}

function LocationCitations({ locationId }: { locationId: string }) {
  const citations = useCitations(locationId);
  if (citations.isPending) return <CitationsLoading />;
  if (citations.isError) return <CitationsError onRetry={() => void citations.refetch()} />;
  if (!citations.data.available) return <CitationsSettingUp />;
  return <CitationsContent data={citations.data} locationId={locationId} />;
}

export default CitationsPage;
