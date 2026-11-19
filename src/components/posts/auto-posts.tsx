import { useState, type ReactNode } from "react";
import { Hourglass, ImageIcon, Plus, Repeat, Sparkles } from "lucide-react";
import type { Post, PostSeries } from "@/api";
import { SectionHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/layout/shared/feedback/states";
import { SeriesCard } from "@/components/posts/series-card";
import { SeriesDialog } from "@/components/posts/series-dialog";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { useAiStatus, type AiStatus } from "@/lib/ai/ai-status";
import { useOptionalLocationRoute } from "@/lib/locations/location-route-context";
import { useActivePostRuns } from "@/lib/posts/ai-runs";
import { sortSeries } from "@/lib/posts/post-order";
import { pausedPlannerOf } from "@/lib/posts/series-planner";
import { postErrorText, usePostSeries } from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";

/** Why "New auto-post series" can't be used right now, or null when it can. */
function createBlocker({ ai, gbpConnected, full }: { ai: AiStatus; gbpConnected: boolean; full: boolean }): string | null {
  if (ai.blockedBy === "checking") return "Checking whether AI is available…";
  if (!ai.canRun) return ai.state === "off" ? "Auto-posts need AI, which isn't switched on yet." : (ai.reason ?? "AI isn't available right now.");
  if (!gbpConnected) return "Connect this location to Google first.";
  if (full) return "Up to 3 series can run at once. Pause or delete one first.";
  return null;
}

/**
 * Auto-posts (AI series, Phase 25c): AI writes each post about 2 days before its slot, then each post waits for
 * review (the default) or, in a series that publishes on its own, goes out at its time unless a safety check holds
 * it. Creating a series is consent to its token spend.
 *
 * New series need AI that can run (`useAiStatus`): while AI is off, a series would skip every slot,
 * so the button stays visible but disabled, with the reason. `photosPublishable: false` turns pictures
 * off by default and warns, since posts with a photo can't publish yet.
 *
 * Phase 25a: each series says whether the server's planner writes its posts (`planner`). While it
 * doesn't, each card says so calmly ("Automatic AI posts are paused"), its slots read "Planned slots
 * (paused)" rather than "Coming up", and "Write the next post now" still works.
 *
 * 2026-11-17: "Write the next post now" runs in the background; the location's active runs are read here once
 * (`useActivePostRuns`, polled every 3 s while any works), so a card shows its run again after a reload.
 * Automatic publishing is switched per account: any series' `auto_publish.switch` tells whether to offer it.
 */
export function AutoPosts({
  locationId,
  timeZone,
  gbpConnected,
  onOpenPost,
  photosPublishable = true,
  startNew = false,
}: {
  locationId: string;
  /** The location's IANA time zone (series times are in it); null when unknown (the server then uses UTC). */
  timeZone: string | null;
  gbpConnected: boolean;
  onOpenPost: (post: Post) => void;
  photosPublishable?: boolean;
  /** Opens the "New auto-post series" dialog straight away when a series can be created (`?new=series`). */
  startNew?: boolean;
}) {
  const canEdit = useCanEdit();
  const ai = useAiStatus(locationId);
  const list = usePostSeries(locationId);
  const runs = useActivePostRuns(locationId);
  // The location's name and client, for the agency client's approval of automatic posts.
  const route = useOptionalLocationRoute();
  const place = route?.location.location_id === locationId ? route.location : null;
  const [editing, setEditing] = useState<PostSeries | "new" | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);

  const series = list.data ? sortSeries(list.data.series) : [];
  const limit = list.data?.limit ?? 3;
  const active = series.filter((entry) => entry.active).length;
  const blocker = createBlocker({ ai, gbpConnected, full: active >= limit });
  // `?new=series` opens the dialog once, as soon as the list and AI status say a series can be created.
  const showNew = editing === "new" || (startNew && !autoOpened && canEdit && list.isSuccess && blocker === null);
  const openSeries = editing === "new" ? null : editing;
  const imagesOn = series.some((entry) => entry.active && entry.include_image);
  // The planner and automatic publishing are switched per account, so any series tells a new one's fate too.
  const pausedPlanner = pausedPlannerOf(series);
  const autoSwitchOn = series.some((entry) => entry.auto_publish?.switch === "on");
  const seriesRuns = { active: runs.runs, ended: runs.ended };

  const header = (
    <SectionHeader
      icon={Repeat}
      tone="ai"
      title="Auto-posts"
      description={`AI writes each post about 2 days before its time. Each post waits for review before it goes out${autoSwitchOn ? ", unless its series publishes on its own" : ""}. Up to ${limit} series at once.`}
      actions={
        canEdit ? (
          <Button variant="ai" disabled={blocker !== null} title={blocker ?? undefined} onClick={() => setEditing("new")}>
            <Plus aria-hidden /> New auto-post series
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div>
      {header}
      <div className="space-y-4">
        {/* Not connected and no series yet: the empty state below already says so. */}
        {canEdit && blocker && list.isSuccess && ai.blockedBy !== "checking" && (!ai.canRun || series.length > 0) ? (
          <Note icon={ai.state === "paused" ? Hourglass : Sparkles} tone={ai.canRun ? "neutral" : "ai"}>
            {!ai.canRun && ai.state === "off"
              ? "Auto-posts need AI, which isn't switched on yet, so new series can't start. A series created now would skip every post. Existing series keep their schedule."
              : !ai.canRun && ai.state === "paused"
                ? `AI is paused for today${ai.resumesAt ? ` (back at ${ai.resumesAt})` : ""}. Auto-posts retry every hour until each post's time passes.`
                : blocker}
          </Note>
        ) : null}
        {!photosPublishable && imagesOn ? (
          <Note icon={ImageIcon} tone="warning">
            Posts with a photo can't be published to Google yet. Turn off "Add an AI image" in your series until then, so their posts go out as text.
          </Note>
        ) : null}

        {list.isPending ? (
          <ListSkeleton rows={2} />
        ) : list.isError ? (
          <ErrorState description={postErrorText(list.error, "Auto-posts couldn't be loaded.").message} onRetry={() => void list.refetch()} />
        ) : series.length === 0 ? (
          <EmptyState
            icon={Repeat}
            tone="ai"
            title="Keep your profile active on autopilot"
            description={
              gbpConnected
                ? "Pick the days and a time. AI plans the topics and writes each post in your voice, and you review it before it goes out, so your Google profile never goes quiet."
                : "Connect this location to Google to let AI post for you on a schedule."
            }
            action={
              canEdit && gbpConnected ? (
                <Button variant="ai" disabled={blocker !== null} title={blocker ?? undefined} onClick={() => setEditing("new")}>
                  <Plus aria-hidden /> Set up auto-posts
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-4">
            {series.map((entry) => (
              <li key={entry.series_id}>
                <SeriesCard
                  locationId={locationId}
                  locationName={place?.name ?? "this location"}
                  clientName={place?.client?.name ?? null}
                  series={entry}
                  ai={ai}
                  gbpConnected={gbpConnected}
                  runs={seriesRuns}
                  onEdit={() => setEditing(entry)}
                  onOpenPost={onOpenPost}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {showNew || openSeries ? (
        <SeriesDialog
          // A fresh form for each series (and for a new one).
          key={openSeries?.series_id ?? "new"}
          locationId={locationId}
          locationZone={timeZone}
          series={openSeries}
          ai={ai}
          photosPublishable={photosPublishable}
          pausedPlanner={openSeries ? pausedPlannerOf([openSeries]) : pausedPlanner}
          autoSwitchOn={autoSwitchOn}
          onClose={() => {
            setEditing(null);
            setAutoOpened(true);
          }}
        />
      ) : null}
    </div>
  );
}

function Note({ icon: Icon, tone, children }: { icon: typeof Sparkles; tone: "ai" | "warning" | "neutral"; children: ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
        tone === "ai" && "border-ai/20 bg-ai-surface text-foreground",
        tone === "warning" && "border-warning/35 bg-warning-surface text-warning-foreground",
        tone === "neutral" && "border-border bg-surface-strong text-foreground",
      )}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone === "ai" ? "text-ai" : tone === "warning" ? "text-warning" : "text-muted-foreground")} />
      <span>{children}</span>
    </p>
  );
}
