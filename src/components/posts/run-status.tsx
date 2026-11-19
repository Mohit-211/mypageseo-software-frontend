/**
 * Background AI runs on posts, on screen (2026-11-17 entry, section 1, "UI states").
 *
 * - `RunProgress`: "Creating…": the kind's line ("Writing your post…", "Changing your post…", "Creating your
 *   picture…", "Writing the next post…", "Finding post ideas…"), the step's detail, after a minute "This can take
 *   a few minutes. You can leave this page.", and a teammate's run by name ("Sam is writing this post").
 * - `SeriesSlotProgress`: a series post its series is writing (`ai_run.kind: "series_slot"`): nothing to poll.
 * - `PictureOutcome`: what a picture run delivered: on the post, back unattached ("Use this picture"; it was
 *   charged), or none ("No picture this time: …", not a failure). Labels the picture.
 * - `RunFailure`: a failed run in the words of the same error at once, with "Try again" (a failed run costs
 *   nothing) or "Reload" (`post_changed`).
 * - `RunNotes`: what a finished "Write with AI" or "Change it" left out, the facts it couldn't use, the
 *   picture, and "Review it, then schedule it again".
 * - `DeclinedNotice`: a request declined whole at once (400 `instructions_declined`; nothing spent).
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ImageOff, LoaderCircle, RefreshCw, RotateCw, Sparkles, X } from "lucide-react";
import type { AiImageResult, AiPictureResult, PostAiRun, PostMediaDetails } from "@/api";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { useAiErrorText } from "@/lib/ai/ai-errors";
import { runErrorFrom, runProgress, useRunElapsed, useViewerUserId, type RunProgress as RunProgressWords } from "@/lib/posts/ai-runs";
import {
  declinedFromError,
  declinedText,
  logoSkippedText,
  mediaLabel,
  noPictureText,
  proposedFactsFromError,
  unattachedText,
} from "@/lib/posts/post-findings";
import { isAiRoutedError } from "@/lib/posts/use-posts";
import { runFailureText, runNotes } from "@/lib/posts/use-post-runs";
import { cn } from "@/lib/utils";
import { ProposedFacts } from "./proposed-facts";

/** What to say for a run now: the elapsed time (from when the page first saw it) ticks every 5 s while it works. */
function useRunWords(run: PostAiRun): RunProgressWords {
  const viewerUserId = useViewerUserId();
  const elapsedMs = useRunElapsed(run);
  return runProgress(run, { elapsedMs, viewerUserId });
}

/**
 * A run that works now. `variant="line"` (a post card: one quiet line) or `"panel"` (the editor, the writer: a
 * tinted box). A teammate's run leads with their name.
 */
export function RunProgress({ run, variant = "panel", className, children }: { run: PostAiRun; variant?: "line" | "panel"; className?: string; children?: ReactNode }) {
  const words = useRunWords(run);
  // A teammate's run leads with their name ("Sam is changing this post"); the kind's line would only repeat it.
  const lead = words.teammate ?? words.title;
  const rest = words.detail ?? "";
  if (variant === "line") {
    return (
      <p role="status" className={cn("flex min-w-0 items-start gap-2 text-sm text-ai", className)}>
        <LoaderCircle aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin" />
        <span className="min-w-0">
          <span className="font-medium">{lead}</span>
          {rest ? <span className="text-muted-foreground"> · {rest}</span> : null}
          {words.note ? <span className="block text-xs text-muted-foreground">{words.note}</span> : null}
        </span>
      </p>
    );
  }
  return (
    <div role="status" className={cn("flex min-w-0 items-start gap-2.5 rounded-lg border border-ai/25 bg-ai-surface/60 px-3 py-2.5", className)}>
      <LoaderCircle aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin text-ai" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{lead}</p>
        {rest ? <p className="text-xs text-muted-foreground">{rest}</p> : null}
        {words.note ? <p className="mt-0.5 text-xs text-muted-foreground">{words.note}</p> : null}
        {children}
      </div>
    </div>
  );
}

/** A series post its series is writing (`ai_run.kind: "series_slot"`): nothing to poll; it fills in later. */
export function SeriesSlotProgress({ variant = "line", className }: { variant?: "line" | "panel"; className?: string }) {
  const text = "Its series is writing this post";
  const detail = "It fills in by itself. Check back in a few minutes.";
  if (variant === "line") {
    return (
      <p role="status" className={cn("flex items-start gap-2 text-sm text-ai", className)}>
        <LoaderCircle aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin" />
        <span>
          <span className="font-medium">{text}</span> <span className="text-muted-foreground">· {detail}</span>
        </span>
      </p>
    );
  }
  return (
    <div role="status" className={cn("flex items-start gap-2.5 rounded-lg border border-ai/25 bg-ai-surface/60 px-3 py-2.5", className)}>
      <LoaderCircle aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin text-ai" />
      <div>
        <p className="text-sm font-medium text-foreground">{text}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

/** A picture with its label ("AI-generated image, not a photo of your business", "Enhanced from your photo"). */
export function LabelledPicture({ media, className }: { media: Pick<PostMediaDetails, "url"> & Partial<PostMediaDetails>; className?: string }) {
  const label = mediaLabel(media);
  return (
    <figure className={cn("w-40 shrink-0", className)}>
      <img src={media.url} alt="" className="aspect-[4/3] w-full rounded-md border border-border object-cover" />
      {label ? (
        <figcaption className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
          <Sparkles aria-hidden className="mt-px size-3 shrink-0 text-ai" /> {label}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * A picture run's outcome (Create image, or the picture of "Write with AI" / "Change it"). `onUse` offers "Use
 * this picture" for one that came back unattached (it was charged when it is an AI image).
 */
export function PictureOutcome({
  image,
  onUse,
  using = false,
  className,
}: {
  image: AiPictureResult | AiImageResult;
  onUse?: ((media: PostMediaDetails) => void) | undefined;
  using?: boolean;
  className?: string;
}) {
  const logoNote = logoSkippedText(image.logo, image.reasons);
  if (!image.media) {
    return (
      <p className={cn("flex items-start gap-2 text-sm text-muted-foreground", className)}>
        <ImageOff aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{noPictureText(image.reasons)} The post stays text only; you can add a picture later.</span>
      </p>
    );
  }
  const media = image.media;
  return (
    <div className={cn("flex flex-wrap items-start gap-3", className)}>
      <LabelledPicture media={media} />
      <div className="min-w-0 flex-1 space-y-1.5 text-sm">
        {image.attached ? (
          <p className="text-foreground">The picture is on the post.</p>
        ) : (
          <>
            <p className="text-foreground">
              {unattachedText(image.attach_error)}
              {media.kind === "ai" && image.attach_error ? " It was charged, so you can still use it." : null}
            </p>
            {onUse ? (
              <Button type="button" size="sm" variant="outline" disabled={using} onClick={() => onUse(media)}>
                {using ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Use this picture
              </Button>
            ) : null}
          </>
        )}
        {logoNote ? <p className="text-xs text-muted-foreground">{logoNote}</p> : null}
      </div>
    </div>
  );
}

/** A failed run in plain words: the same words as the error at once, with what to do next. */
export function RunFailure({
  run,
  fallback,
  locationId,
  onRetry,
  onReload,
  onDismiss,
  newTab = false,
  className,
}: {
  run: PostAiRun;
  fallback: string;
  /** Offers the statements the AI couldn't use as facts (an `instructions_declined` run). */
  locationId?: string;
  onRetry?: (() => void) | undefined;
  onReload?: (() => void) | undefined;
  onDismiss?: (() => void) | undefined;
  newTab?: boolean;
  className?: string;
}) {
  const aiText = useAiErrorText();
  const error = runErrorFrom(run);
  const changed = error?.reason === "post_changed";
  let title = fallback;
  let description = runFailureText(error);
  // What the same error offers at once ("Buy tokens" for an owner's 402, billing, support).
  let link: { label: string; href: string } | null = null;
  if (error && isAiRoutedError(error)) {
    const text = aiText(error, { fallback });
    title = text.title;
    description = text.description;
    link = text.action ?? null;
  }
  const declined = declinedText(declinedFromError(error));
  const facts = proposedFactsFromError(error);
  return (
    <div role="alert" className={cn("flex items-start gap-2.5 rounded-lg border border-critical/25 bg-critical-surface px-3 py-2.5", className)}>
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-critical" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-critical">{title}</p>
        <p className="text-sm text-foreground">{description}</p>
        {declined ? <p className="mt-1 text-sm text-foreground">{declined}</p> : null}
        {locationId && facts.length ? <ProposedFacts locationId={locationId} facts={facts} newTab={newTab} className="mt-2 bg-card" /> : null}
        {(changed && onReload) || (!changed && onRetry) || link ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {link ? (
              <Button asChild size="sm" variant="outline">
                {newTab ? (
                  <a href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <Link to={link.href}>{link.label}</Link>
                )}
              </Button>
            ) : null}
            {changed && onReload ? (
              <Button type="button" size="sm" variant="outline" onClick={onReload}>
                <RefreshCw aria-hidden /> Reload the post
              </Button>
            ) : null}
            {!changed && onRetry ? (
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                <RotateCw aria-hidden /> Try again
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {onDismiss ? <DismissButton onDismiss={onDismiss} /> : null}
    </div>
  );
}

/**
 * A request the AI declined whole, at once (400 `instructions_declined`): what it left out and why, and the
 * statements it couldn't use ("Add as a fact"). Nothing was written and nothing was spent.
 */
export function DeclinedNotice({
  error,
  locationId,
  newTab = false,
  title = "Nothing was written, and nothing was spent.",
  className,
}: {
  error: unknown;
  locationId: string;
  newTab?: boolean;
  title?: string;
  className?: string;
}) {
  const declined = declinedText(declinedFromError(error));
  const facts = proposedFactsFromError(error);
  return (
    <div role="alert" className={cn("space-y-2 rounded-lg border border-warning/35 bg-warning-surface px-3 py-2.5 text-sm text-warning-foreground", className)}>
      <p className="font-medium">{title}</p>
      <p>{declined ?? "None of these changes can be made to a post. Change your request and try again."}</p>
      {facts.length ? <ProposedFacts locationId={locationId} facts={facts} newTab={newTab} className="bg-card" /> : null}
    </div>
  );
}

export function DismissButton({ onDismiss, label = "Dismiss" }: { onDismiss: () => void; label?: string }) {
  return (
    <Button type="button" variant="ghost" size="icon" className="-mr-1 -mt-1 size-8 shrink-0" aria-label={label} onClick={onDismiss}>
      <X aria-hidden />
    </Button>
  );
}

/**
 * What a finished "Write with AI" or "Change it" adds to its post: the parts left out, the facts it couldn't use,
 * the picture, and "Review it, then schedule it again" when "Change it" took a scheduled post back to drafts.
 * Empty when there is nothing to say.
 */
export function RunNotes({
  locationId,
  run,
  onUsePicture,
  usingPicture = false,
  newTab = false,
  className,
}: {
  locationId: string;
  run: PostAiRun;
  onUsePicture?: ((media: PostMediaDetails) => void) | undefined;
  usingPicture?: boolean;
  newTab?: boolean;
  className?: string;
}) {
  const notes = runNotes(run);
  if (!notes) return null;
  const declined = declinedText(notes.declined);
  const { facts } = notes;
  return (
    <div className={cn("space-y-2.5", className)}>
      {notes.unscheduled ? (
        <p className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium">Review it, then schedule it again.</span> The new text didn't pass every check, so the post went back to drafts
            instead of going out unread.
          </span>
        </p>
      ) : null}
      {declined ? <p className="text-sm text-foreground">{declined}</p> : null}
      {facts.length ? <ProposedFacts locationId={locationId} facts={facts} newTab={newTab} /> : null}
      {notes.image ? <PictureOutcome image={notes.image} onUse={onUsePicture} using={usingPicture} /> : null}
    </div>
  );
}

/** "Written with AI" / "Changed by AI" badge for a finished run row. */
export function RunDoneBadge({ run }: { run: PostAiRun }) {
  const label = run.kind === "revise" ? "Changed by AI" : run.kind === "image" ? "Picture ready" : run.kind === "plan" ? "Topics planned" : "Written by AI";
  return (
    <StatusBadge tone="ai" icon={Sparkles} size="sm">
      {label}
    </StatusBadge>
  );
}
