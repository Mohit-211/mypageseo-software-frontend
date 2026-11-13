import { Link, Navigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { MapPinPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/shared/data-display";
import { NotFoundScreen } from "@/components/layout/shared/feedback/not-found";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import {
  LOCATION_SECTION_LABELS,
  locationPath,
  pickNavLocationId,
  portfolioSectionFor,
  withSearchAndHash,
} from "@/lib/mypageseo/section-links";
import { useWorkspace } from "@/lib/mypageseo/workspace";

/**
 * A portfolio address (`/rankings/tracker`, `/gbp`, `/ai/posts`, … from a bookmark, a help
 * article or an email) opens that page for a location: the one picked last, else the first.
 * It renders inside the shell: a skeleton while the workspace loads, then it hands over
 * (replacing this entry, so Back skips it) and keeps the skeleton up while the page's code
 * arrives. Without locations it says so instead of redirecting.
 */
export function PortfolioRedirect() {
  const { pathname, search, hash } = useLocation();
  const workspace = useWorkspace();
  const queryClient = useQueryClient();
  const canEdit = useCanEdit();
  const target = portfolioSectionFor(pathname);

  if (!target) return <NotFoundScreen />;
  if (workspace.status === "loading") return <PageSkeleton />;

  const title = LOCATION_SECTION_LABELS[target.section];
  if (workspace.status === "unavailable") {
    return (
      <>
        <PageHeader title={title} />
        <ErrorState
          description="Your locations couldn't be loaded. Try again without leaving this page."
          onRetry={() => void queryClient.refetchQueries({ predicate: (query) => query.queryKey[0] === "profile" || (query.queryKey[0] === "locations" && query.queryKey[1] === "workspace") })}
        />
      </>
    );
  }

  const locationId = pickNavLocationId({
    activeLocationId: workspace.activeLocation?.id,
    locationIds: workspace.locations.map((location) => location.id),
  });
  if (!locationId) {
    return (
      <>
        <PageHeader title={title} />
        <EmptyState
          icon={MapPinPlus}
          title="Add your first location"
          description={`${title} works on one location at a time. Add the business you want to track and it opens here.`}
          action={
            canEdit ? (
              <Button asChild>
                <Link to="/locations/add">
                  <MapPinPlus aria-hidden /> Add location
                </Link>
              </Button>
            ) : undefined
          }
        />
      </>
    );
  }

  const to = withSearchAndHash(locationPath(locationId, target.section, target.suffix ?? ""), { search, hash });
  return (
    <>
      <Navigate to={to} replace />
      <PageSkeleton />
    </>
  );
}
