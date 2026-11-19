/**
 * Automatic replies to 4–5★ reviews (Phase 25b) where reviews are read:
 * - `AutoReplySummaryLine`: "Automatic replies: on · 3 sent this week · 1 held for a person", linking to the settings
 *   card on AI Settings (`#auto-replies`). Shown only while the server's switch is `on` (`GET …/reviews/auto-reply`
 *   → `feature`), on Reviews and AI Review Replies.
 * - `AutoReplyReviewNote`: where one review's automatic reply stands (being written, goes out at …, held for a
 *   person with why, cancelled). The reply itself says "Sent automatically" (`ReplyOnGoogle`).
 */
import { Link } from "react-router-dom";
import { Ban, Bot, CalendarClock, Hand, LoaderCircle, Send, type LucideIcon } from "lucide-react";
import type { Review, ReviewsSummary } from "@/api";
import { STATUS_TONE_CLASSES } from "@/components/layout/shared/module-tone";
import { formatDateTime } from "@/lib/datetime";
import { locationPath } from "@/lib/mypageseo/section-links";
import { autoReplyLine, autoReplyNote, useAutoReplyFeature, type AutoReplyNote } from "@/lib/reviews/auto-reply";
import { cn } from "@/lib/utils";

const INLINE_LINK = "rounded-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring";

export function AutoReplySummaryLine({ locationId, summary, className }: { locationId: string; summary: ReviewsSummary; className?: string }) {
  const line = autoReplyLine(summary.auto_reply);
  const feature = useAutoReplyFeature(locationId, line !== null);
  if (!line || feature !== "on") return null;
  return (
    <p className={cn("inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground", className)}>
      <Bot aria-hidden className={cn("size-3.5 shrink-0", STATUS_TONE_CLASSES[line.tone].text)} />
      <span>{line.text}</span>
      <span aria-hidden>·</span>
      {/* An inline link in a line of small print: the invisible hit area makes it about 40px tall. */}
      <Link to={locationPath(locationId, "ai/settings", "#auto-replies")} className={cn(INLINE_LINK, "relative after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-['']")}>
        {line.state === "off" ? "Set up" : "Settings"}
        <span className="sr-only"> for automatic replies</span>
      </Link>
    </p>
  );
}

const NOTE_ICON: Record<AutoReplyNote["state"], LucideIcon> = {
  queued: LoaderCircle,
  drafting: LoaderCircle,
  scheduled: CalendarClock,
  sending: Send,
  sent: Send,
  held: Hand,
  cancelled: Ban,
};

/** Where the review's automatic reply stands, as a quiet line with an icon; nothing when it isn't handled automatically. */
export function AutoReplyReviewNote({
  review,
  now,
  canEdit,
  className,
}: {
  review: Pick<Review, "auto" | "draft">;
  now?: number | undefined;
  canEdit: boolean;
  className?: string;
}) {
  const note = autoReplyNote(review, { now, canEdit });
  if (!note) return null;
  const Icon = NOTE_ICON[note.state];
  const spinning = note.state === "queued" || note.state === "drafting";
  const tone = STATUS_TONE_CLASSES[note.tone];
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", tone.badge, "text-foreground", className)}>
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone.text, spinning && "animate-spin motion-reduce:animate-none")} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {note.at ? (
            <span title={formatDateTime(note.at)}>{note.title}</span>
          ) : (
            note.title
          )}
          {note.labels.length > 0 ? <span className="font-normal">: {note.labels.join("; ")}</span> : null}
        </p>
        {note.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{note.detail}</p> : null}
      </div>
    </div>
  );
}
