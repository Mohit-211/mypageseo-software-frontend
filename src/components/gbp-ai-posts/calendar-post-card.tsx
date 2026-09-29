import { format } from "date-fns";
import { Repeat } from "lucide-react";
import { AI_POST_STATUS_LABEL, type AiGbpPost } from "@/lib/gbp/ai-posts";
import { cn } from "@/lib/utils";
import { PostStatusBadge, PostThumbnail } from "./post-ui";

/** Compact post card for calendar cells and day lists. */
export function CalendarPostCard({
  post,
  onSelect,
  variant = "cell",
}: {
  post: AiGbpPost;
  onSelect: (post: AiGbpPost) => void;
  /** `cell` fits a month-grid cell; `row` is the roomier mobile day list. */
  variant?: "cell" | "row";
}) {
  const when = post.scheduledAt ?? post.publishedAt;
  const time = when ? format(new Date(when), "h:mm a") : "No time set";
  const row = variant === "row";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(post);
      }}
      aria-label={`${post.title}, ${time}, ${AI_POST_STATUS_LABEL[post.status]}`}
      className={cn(
        "group/card flex w-full min-w-0 items-center gap-2 rounded-md border border-border bg-surface text-left shadow-card transition-colors hover:border-primary/40 hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
        row ? "p-2" : "p-1",
        post.status === "failed" && "border-critical/30",
      )}
    >
      <PostThumbnail
        src={post.imageUrl}
        className={row ? "size-12" : "hidden size-8 rounded xl:block"}
        iconClassName={row ? "size-4" : "size-3"}
      />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-medium text-foreground", row ? "text-sm" : "text-[11px] leading-tight")}>
          {post.title}
        </span>
        <span className={cn("flex min-w-0 items-center", row ? "mt-1 gap-2" : "mt-0.5 flex-wrap gap-x-1 gap-y-0.5")}>
          <span className={cn("shrink-0 tabular text-muted-foreground", row ? "text-xs" : "text-[10px]")}>{time}</span>
          {post.recurrence !== "none" ? <Repeat className="size-2.5 shrink-0 text-muted-foreground" aria-label="Recurring" /> : null}
          {/* In grid cells the badge wraps to its own line rather than clipping. */}
          <PostStatusBadge status={post.status} compact={!row} className={cn(!row && "basis-auto")} />
        </span>
      </span>
    </button>
  );
}
