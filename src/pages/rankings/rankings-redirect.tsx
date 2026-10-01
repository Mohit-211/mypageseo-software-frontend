import { Link, Navigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/mypageseo/workspace";

/**
 * The sidebar's Rankings entries open the selected location's ranking pages
 * (the header's location, else the first one), so there is one set of ranking screens.
 */
export function RankingsRedirect({ view }: { view: "" | "keywords" | "groups" | "map" | "grid" }) {
  const workspace = useWorkspace();
  if (workspace.status === "loading") {
    return <AppShell><PageSkeleton /></AppShell>;
  }
  if (workspace.status === "unavailable") {
    return <AppShell><ErrorState description="Your locations couldn't be loaded." onRetry={() => window.location.reload()} /></AppShell>;
  }
  const location = workspace.activeLocation ?? workspace.locations[0] ?? null;
  if (!location) {
    return (
      <AppShell>
        <PageHeader title="Rankings" description="Google Maps rankings for each of your locations." />
        <EmptyState
          icon={MapPin}
          title="No locations yet"
          description="Add a location and its keywords to start tracking rankings."
          action={<Button asChild size="sm"><Link to="/locations/add">Add location</Link></Button>}
        />
      </AppShell>
    );
  }
  return <Navigate to={`/locations/${location.id}/rankings${view ? `/${view}` : ""}`} replace />;
}
