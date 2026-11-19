import { useId } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Check, Clock, ExternalLink, Image as ImageIcon, LoaderCircle, MapPin, MousePointerClick, Sparkles, XCircle } from "lucide-react";
import type { ReviewQueuePost } from "@/api";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAccess } from "@/hooks/use-access";
import { locationPath } from "@/lib/mypageseo/section-links";
import { approvalReasonLabel, heldLabels, waitsForText } from "@/lib/posts/approval-labels";
import { IMAGE_SOURCE_LABEL, mediaLabel, postStandingContext, standingHardFindings } from "@/lib/posts/post-findings";
import { POST_TYPE_LABEL, formatEventRange, formatPostMoment, postTimeline } from "@/lib/posts/post-format";
import { CTA_LABEL } from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";
import { LabelToneIcon } from "./label-line";
import { PostFindingsList, PostFindingsText } from "./post-findings";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The post's own `post_id` link on its location's Posts page (read by id when it isn't on the list's page). */
const postPath = (post: Pick<ReviewQueuePost, "location_id" | "post_id">) => locationPath(post.location_id, "gbp/posts", `?post=${encodeURIComponent(post.post_id)}`);

/** The post's first words (its event's title first), to tell two posts of one location apart in a label. */
function leadWords(post: Pick<ReviewQueuePost, "event" | "summary">): string {
  const words = (post.event?.title || post.summary || "").trim().split(/\s+/).filter(Boolean);
  return words.length > 8 ? `${words.slice(0, 8).join(" ")}…` : words.join(" ");
}

/**
 * One AI post waiting for a person, in the review queue: its location, when it goes out, why it waits
 * (`approval.reason`), its review time (`approval.expires_at`), why an automatic post was held (`approval.held`), the
 * text with what the checks flagged highlighted (a hard finding that still stands must change before it can be
 * approved), its picture, and Approve when the viewer may (`can_approve`); otherwise who it waits for. The findings
 * and the picture's label read as on the post card (`post-findings`). Colour is never alone: each flag has an icon
 * and words.
 */
export function ReviewQueueCard({
  post,
  now,
  selected,
  onSelect,
  onApprove,
  approving,
  disabled,
  note,
}: {
  post: ReviewQueuePost;
  now: number;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onApprove: () => void;
  /** This post is being approved. */
  approving: boolean;
  /** Another approval runs, or the page shows the previous filter's posts while the next load. */
  disabled: boolean;
  /** Why the last approval of this post didn't go through. */
  note: string | null;
}) {
  const titleId = useId();
  const { role } = useAccess();
  const text = post.summary ?? "";
  const findings = post.ai?.findings ?? [];
  // A hard finding that still stands blocks the approval (422 `checks_failed`): change those words first. The same
  // rule as the post card (`standingHardFindings`: exact words; whole-text ones until a person edits the text).
  const standing = postStandingContext(post);
  const blocked = standingHardFindings(post.ai, standing).length > 0;
  const canApprove = Boolean(post.can_approve) && !blocked;
  const reason = approvalReasonLabel(post.approval?.reason);
  const held = heldLabels(post.approval?.held);
  const expiresAt = post.approval?.expires_at ?? null;
  const expiresMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const soon = Number.isFinite(expiresMs) && expiresMs - now < DAY_MS;
  const media = post.media[0];
  const image = media?.url ?? post.google.media_url;
  // The same label as the post card: the photo's own, else one from its kind; a library photo says so.
  const aiPicture = mediaLabel(media);
  const picture = aiPicture ?? (post.ai?.image?.source === "library" ? IMAGE_SOURCE_LABEL.library : null);
  const eventRange = post.event ? formatEventRange(post.event) : null;

  return (
    <article
      aria-labelledby={titleId}
      aria-busy={approving || undefined}
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-card transition-[border-color,box-shadow] sm:flex-row sm:p-5",
        selected ? "border-primary/50 ring-2 ring-primary/20" : "border-border",
      )}
    >
      {image ? (
        <figure className="shrink-0 self-start max-sm:w-full sm:w-44">
          <img src={image} alt="" loading="lazy" className="aspect-[16/9] w-full rounded-lg border border-border object-cover sm:aspect-[4/3]" />
          {picture ? (
            <figcaption className="mt-1.5 flex items-start gap-1 text-xs text-muted-foreground">
              {aiPicture ? <Sparkles aria-hidden className="mt-px size-3 shrink-0 text-ai" /> : <ImageIcon aria-hidden className="mt-px size-3 shrink-0" />} {picture}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {post.can_approve ? (
            <Checkbox
              checked={selected}
              disabled={!canApprove || disabled}
              onCheckedChange={(value) => onSelect(value === true)}
              // Two posts of one location must not share a name: say which post.
              aria-label={`Select the post “${leadWords(post) || postTimeline(post)}” for ${post.location_name ?? "this location"}`}
              className="mr-0.5"
            />
          ) : null}
          <h3 id={titleId} className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
            <MapPin aria-hidden className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">{post.location_name ?? "A location"}</span>
          </h3>
          <StatusBadge tone="neutral" size="sm">
            {POST_TYPE_LABEL[post.type]}
          </StatusBadge>
          <StatusBadge tone="ai" icon={Sparkles} size="sm">
            {post.series_id ? "AI · Auto-post" : "Written with AI"}
          </StatusBadge>
          <span className="text-xs font-medium text-muted-foreground">{postTimeline(post)}</span>
        </div>

        {reason || expiresAt ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            {reason ? (
              <span className="inline-flex items-start gap-1.5 text-foreground">
                <LabelToneIcon tone={reason.tone} className="mt-0.5" />
                {reason.text}
              </span>
            ) : null}
            {expiresAt ? (
              <span className={cn("inline-flex items-center gap-1.5 font-medium", soon ? "text-warning-foreground" : "text-muted-foreground")}>
                <Clock aria-hidden className={cn("size-4 shrink-0", soon ? "text-warning" : "text-muted-foreground")} />
                Review by {formatPostMoment(expiresAt, { weekday: true })}
                <span className="sr-only">. After that it goes back to drafts.</span>
              </span>
            ) : null}
          </div>
        ) : null}
        {held.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Why it waits for a person">
            {held.map((label) => (
              <li key={label.text}>
                <StatusBadge tone={label.tone === "ai" ? "ai" : label.tone === "critical" ? "critical" : label.tone === "warning" ? "warning" : "neutral"} size="sm">
                  {label.text}
                </StatusBadge>
              </li>
            ))}
          </ul>
        ) : null}

        {post.event?.title || eventRange ? (
          <div className="space-y-0.5">
            {post.event?.title ? <p className="text-base font-semibold leading-snug text-foreground">{post.event.title}</p> : null}
            {eventRange ? (
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays aria-hidden className="size-4 shrink-0" />
                <span className="font-medium text-foreground">{eventRange}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {text ? <PostFindingsText text={text} findings={findings} context={standing} /> : <p className="text-sm italic text-muted-foreground">No text yet</p>}

        {post.cta ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MousePointerClick aria-hidden className="size-3.5" /> Button: <span className="font-medium text-foreground">{CTA_LABEL[post.cta.type]}</span>
          </p>
        ) : null}

        {findings.length > 0 ? (
          <div className="rounded-lg border border-border bg-surface-strong px-3 py-2.5">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What our checks found</p>
            <PostFindingsList findings={findings} text={text} context={standing} />
          </div>
        ) : null}

        {note ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-critical/25 bg-critical-surface px-3 py-2 text-sm text-foreground">
            <XCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-critical" />
            <span>
              <span className="font-semibold">Not approved.</span> {note}
            </span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {post.can_approve ? (
            <Button size="sm" disabled={!canApprove || disabled || approving} aria-busy={approving || undefined} onClick={onApprove}>
              {approving ? <LoaderCircle aria-hidden className="animate-spin" /> : <Check aria-hidden />} Approve
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <Link to={postPath(post)}>
              <ExternalLink aria-hidden /> Open post
            </Link>
          </Button>
          {blocked && post.can_approve ? (
            <span className="text-xs text-critical">Change the words marked “Must change” before you approve it.</span>
          ) : !post.can_approve && !note ? (
            <span className="text-xs text-muted-foreground">{waitsForText(post.approval?.reason, role)}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
