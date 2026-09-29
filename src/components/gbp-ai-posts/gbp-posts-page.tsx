import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { MapPin, Plus, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PostsCalendar, PostsCalendarSkeleton } from "./posts-calendar";
import { PostsSummaryCards, PostsSummaryCardsSkeleton } from "./posts-summary-cards";
import { PublishingSchedule } from "./publishing-schedule";
import { UpcomingPosts, UpcomingPostsSkeleton } from "./upcoming-posts";
import { AI_POSTS_PATH } from "./post-ui";
import { useWorkspaceAiPosts } from "./use-workspace-ai-posts";

const ALL_PROFILES = "all";

/** AI GBP Posts dashboard: summary, schedule, calendar and upcoming queue. */
export function GBPPostsPage() {
  const navigate = useNavigate();
  const { status, posts, schedule, locations } = useWorkspaceAiPosts();
  const [profile, setProfile] = useState(ALL_PROFILES);

  const scoped = profile === ALL_PROFILES ? posts : posts.filter((p) => p.locationId === profile);
  const create = (date?: Date) => {
    const params = new URLSearchParams();
    if (date) params.set("date", format(date, "yyyy-MM-dd"));
    if (profile !== ALL_PROFILES) params.set("profile", profile);
    const query = params.toString();
    navigate(`${AI_POSTS_PATH}/create${query ? `?${query}` : ""}`);
  };

  const header = (
    <PageHeader
      title="AI GBP Posts"
      description="Create, schedule and manage AI-powered Google Business Profile posts."
      actions={
        <Button onClick={() => create()} disabled={locations.length === 0}>
          <Plus aria-hidden /> Create Post
        </Button>
      }
    />
  );

  if (status === "loading") {
    return (
      <div className="space-y-6">
        {header}
        <div role="status" aria-live="polite" aria-label="Loading AI GBP posts" className="space-y-6">
          <PostsSummaryCardsSkeleton />
          <Skeleton className="h-40 w-full rounded-lg" />
          <PostsCalendarSkeleton />
          <UpcomingPostsSkeleton />
        </div>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={MapPin}
          title="No Google Business Profiles in this workspace"
          description="Add a location and connect its Google Business Profile to start creating AI posts."
          action={<Button onClick={() => navigate("/locations/add")}>Add location</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {locations.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Profile</span>
          <Select value={profile} onValueChange={setProfile}>
            <SelectTrigger className="h-9 w-full text-sm sm:w-72" aria-label="Filter by business profile">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROFILES}>All profiles ({locations.length})</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>{location.businessName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <PostsSummaryCards posts={scoped} />

      <PublishingSchedule key={JSON.stringify(schedule)} schedule={schedule} />

      {scoped.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No posts yet"
          description="Generate your first Google Business Profile post with AI — we'll write the copy and create an image for you."
          action={<Button onClick={() => create()}><Plus aria-hidden /> Create Post</Button>}
        />
      ) : (
        <PostsCalendar
          posts={scoped}
          onSelectPost={(post) => navigate(`${AI_POSTS_PATH}/${post.id}`)}
          onCreateOnDate={(date) => create(date)}
        />
      )}

      <UpcomingPosts posts={scoped} onCreate={() => create()} />
    </div>
  );
}
