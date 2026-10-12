import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { getOrganizationPostsCalendar } from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { PostsCalendar } from "@/components/posts/posts-calendar";
import { useMonth } from "@/lib/posts/calendar";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { postErrorText } from "@/lib/posts/use-posts";

/** Posts across every location (`GET /posts/calendar`); writing happens on each location's Posts page. */
function GbpPostsPage() {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const { month, shift, from, to } = useMonth();
  const calendar = useQuery({
    queryKey: ["posts", "calendar", workspace.organization?.id ?? null, from, to],
    queryFn: ({ signal }) => getOrganizationPostsCalendar(from, to, undefined, signal),
    enabled: workspace.status === "ready",
    retry: false,
  });

  if (workspace.status === "loading") return <AppShell><PageSkeleton /></AppShell>;

  return (
    <AppShell>
      <PageHeader title="Posts" description="Scheduled and published Google Business Profile posts across your locations." />
      {workspace.locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No locations yet"
          description="Add a location to write and schedule posts."
          action={<Button asChild size="sm"><Link to="/locations/add">Add location</Link></Button>}
        />
      ) : (
        <>
          <Panel title="Write and manage posts" description="Posts, approvals and auto-posts live on each location's Posts page.">
            <ul className="-m-4 divide-y divide-border">
              {workspace.locations.map((location) => (
                <li key={location.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{location.businessName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{location.area}</span>
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/locations/${location.id}/gbp/posts`}>Posts <ArrowRight aria-hidden /></Link>
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Calendar" description="Every location's dated posts. Drafts aren't on the calendar.">
            {calendar.isError ? (
              <ErrorState description={postErrorText(calendar.error, "The calendar couldn't be loaded.").message} onRetry={() => void calendar.refetch()} />
            ) : (
              <PostsCalendar
                month={month}
                onShift={shift}
                items={calendar.data?.items}
                loading={calendar.isPending}
                showLocation
                onOpen={(item) => navigate(`/locations/${item.location_id}/gbp/posts?tab=${item.status === "published" ? "published" : "scheduled"}`)}
              />
            )}
          </Panel>
        </>
      )}
    </AppShell>
  );
}

export default GbpPostsPage;
