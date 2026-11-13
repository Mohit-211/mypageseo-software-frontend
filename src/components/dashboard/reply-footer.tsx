import { Link } from "react-router-dom";
import { ArrowRight, MessageSquareReply, Sparkles } from "lucide-react";
import { TILE_FOOTER_LINK } from "@/components/dashboard/tile-link";
import { needsReplyPath, replyLink, type WritingMode } from "@/lib/dashboard/replies";
import { cn } from "@/lib/utils";

/**
 * A Reviews tile's footer while reviews wait for an answer (dashboard and location Overview). The
 * count is every review without a reply and opens that list on the Reviews page (the same number as
 * its "Needs reply" view). While AI can run, a second link drafts them with AI; when AI is off or
 * paused for the day the link says "Reply now", and read-only users get "See reviews".
 */
export function ReplyFooter({ locationId, unreplied, writing }: { locationId: string; unreplied: number; writing: WritingMode }) {
  const count = `${unreplied.toLocaleString()} ${unreplied === 1 ? "needs" : "need"} a reply`;
  const reply = replyLink(writing, locationId);
  if (writing === "ai") {
    return (
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link to={needsReplyPath(locationId)} className={TILE_FOOTER_LINK}>
          <MessageSquareReply aria-hidden className="size-3.5" /> {count}
        </Link>
        <Link to={reply.to} className={cn(TILE_FOOTER_LINK, "text-ai hover:text-ai-hover")}>
          <Sparkles aria-hidden className="size-3.5" /> {reply.label}
        </Link>
      </span>
    );
  }
  // By hand or just to look: both open the same list, so one link says both.
  return (
    <Link to={reply.to} className={TILE_FOOTER_LINK}>
      <MessageSquareReply aria-hidden className="size-3.5" />
      {count} · {reply.label} <ArrowRight aria-hidden className="size-3.5" />
    </Link>
  );
}
