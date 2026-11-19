/**
 * "Write with AI" on AI Posts (post writer v2, Phase 25c; background runs, 2026-11-17 section 1).
 *
 * The AI writes from the business's facts, checks, judges and fixes the post, and saves it as a draft. That can
 * take minutes, so a click starts a run (202 `{ run, existing }`): the writer shows "Writing your post…" with its
 * step, and when the run is done the new draft opens in the editor (`onReady`), with what the AI left out, the
 * statements it couldn't use ("Add as a fact") and its picture. Leaving the page never stops a run; coming back
 * shows the runs still working and "Your post is ready" for the ones that finished (`?status=recent`).
 *
 * - The topic: the best waiting topic of the location's plan (`{}`, the default), a topic of the list below
 *   ("Write this post": `{ topic_id }`), or the user's own (`{ topic, type }`).
 * - Options: what to stress (`instructions`, ≤ 500), the tone, the button, up to 3 keywords (2 are used), and
 *   a picture in the same run (`image: true`: a library photo when one fits, else an AI image).
 *
 * Also exports the option fields the post editor's AI panel reuses.
 */
import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, ExternalLink, LoaderCircle, Sparkles, X } from "lucide-react";
import {
  aiDraftPost,
  updatePost,
  type AiDraftInput,
  type ApiError,
  type CtaType,
  type Post,
  type PostAiRun,
  type PostMediaDetails,
  type PostTone,
  type PostTopic,
  type PostType,
} from "@/api";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { AiStatusBanner } from "@/components/ai/ai-status-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAiFacts } from "@/lib/ai-settings/use-ai-settings";
import { sameKeyword } from "@/lib/keywords/keywords";
import { keywordsPath } from "@/lib/keywords/paths";
import { runIsActive, useActivePostRuns, useAiRun } from "@/lib/posts/ai-runs";
import type { PostAiState } from "@/lib/posts/post-ai-state";
import { POST_TYPE_LABEL } from "@/lib/posts/post-format";
import { useToastPostError } from "@/lib/posts/post-toasts";
import { isReadyRun, retryStartOf, useOnRunEnd, usePostRunStart, useReadyRuns } from "@/lib/posts/use-post-runs";
import {
  AI_INSTRUCTIONS_MAX,
  AI_TOPIC_MAX,
  AI_TOPIC_MIN,
  CTA_LABEL,
  MAX_DRAFT_KEYWORDS,
  TONE_LABEL,
  USED_DRAFT_KEYWORDS,
  useInvalidatePosts,
} from "@/lib/posts/use-posts";
import { useTracking } from "@/lib/rankings/use-rankings";
import { cn } from "@/lib/utils";
import { DeclinedNotice, DismissButton, RunDoneBadge, RunFailure, RunNotes, RunProgress } from "./run-status";
import { TopicsBacklog } from "./topics-backlog";

/* -------------------------------------------------------------------------- */
/* Option fields (also used by the post editor's AI panel)                      */
/* -------------------------------------------------------------------------- */

/** "Your usual voice" sends no tone: the business's own voice (its brief and best past posts) decides. */
export type ToneChoice = PostTone | "usual";
/** "Let AI choose" sends no button: Learn more (the service's page) or Call, as the post suits. */
export type CtaChoice = CtaType | "auto";

const TYPES: { value: PostType; label: string }[] = (["standard", "event", "offer"] as const).map((value) => ({ value, label: POST_TYPE_LABEL[value] }));

export function ToneSelect({ value, onChange, disabled }: { value: ToneChoice; onChange: (value: ToneChoice) => void; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as ToneChoice)} disabled={disabled}>
      <SelectTrigger className="w-full sm:w-48" aria-label="Tone">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="usual">Your usual voice</SelectItem>
        {(Object.keys(TONE_LABEL) as PostTone[]).map((tone) => (
          <SelectItem key={tone} value={tone}>
            {TONE_LABEL[tone]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CtaSelect({ value, onChange, disabled }: { value: CtaChoice; onChange: (value: CtaChoice) => void; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as CtaChoice)} disabled={disabled}>
      <SelectTrigger className="w-full sm:w-48" aria-label="Button">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="auto">Let AI choose</SelectItem>
        {(Object.keys(CTA_LABEL) as CtaType[]).map((type) => (
          <SelectItem key={type} value={type}>
            {CTA_LABEL[type]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** What to stress or change (≤ 500). */
export function InstructionsField({
  value,
  onChange,
  label = "Anything to stress? (optional)",
  placeholder = "e.g. Mention the new evening hours",
  hint,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <Textarea
        id={id}
        rows={2}
        maxLength={AI_INSTRUCTIONS_MAX}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={`${id}-hint`} className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
        <span>{hint ?? "Phone numbers, links, hashtags and emoji are left out: Google's post rules don't allow them."}</span>
        <span className="tabular-nums">
          {value.length} / {AI_INSTRUCTIONS_MAX}
        </span>
      </p>
    </div>
  );
}

/** Up to 3 tracked keywords to use (post writer v2 uses at most 2). */
export function KeywordPicker({
  locationId,
  value,
  onChange,
  showManageLink = false,
  disabled,
}: {
  locationId: string;
  value: string[];
  onChange: (value: string[]) => void;
  /** A link to Keywords (not inside the editor: leaving would drop the unsaved post). */
  showManageLink?: boolean;
  disabled?: boolean;
}) {
  const tracking = useTracking(locationId);
  const tracked = tracking.data?.tracking.keywords.map((keyword) => keyword.text) ?? [];
  const noneTracked = tracking.isSuccess && tracked.length === 0;
  const available = tracked.filter((keyword) => !value.some((chosen) => sameKeyword(chosen, keyword)));
  const add = (keyword: string) => {
    if (value.length >= MAX_DRAFT_KEYWORDS || value.some((chosen) => sameKeyword(chosen, keyword))) return;
    onChange([...value, keyword]);
  };
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Keywords to use ({value.length}/{MAX_DRAFT_KEYWORDS}):
        </span>
        {value.map((keyword) => (
          <Badge key={keyword} variant="brand" className="gap-1 pr-1">
            {keyword}
            <button
              type="button"
              aria-label={`Remove ${keyword}`}
              disabled={disabled}
              className="relative grid size-5 cursor-pointer place-items-center rounded-full outline-hidden after:absolute after:-inset-2 after:content-[''] hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onChange(value.filter((item) => item !== keyword))}
            >
              <X className="size-3" aria-hidden />
            </button>
          </Badge>
        ))}
        {value.length < MAX_DRAFT_KEYWORDS && available.length > 0 ? (
          <Select value="" onValueChange={add} disabled={disabled}>
            <SelectTrigger className="h-8 w-44 text-xs" aria-label="Add a tracked keyword">
              <SelectValue placeholder="Add a keyword" />
            </SelectTrigger>
            <SelectContent>
              {available.map((keyword) => (
                <SelectItem key={keyword} value={keyword}>
                  {keyword}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : value.length === 0 && noneTracked ? (
          <span className="text-xs text-muted-foreground">None tracked yet.</span>
        ) : null}
        {showManageLink && (noneTracked || tracked.length > 0) ? (
          <Button asChild variant="link" size="sm" className="relative h-8 px-1.5 after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']">
            <Link to={keywordsPath(locationId)}>
              {noneTracked ? "Add keywords" : "Manage keywords"} <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        AI uses at most {USED_DRAFT_KEYWORDS}, once each and naturally. Pick none and the topic's keyword or your keyword plan decides.
      </p>
    </div>
  );
}

/** A picture in the same run (`image: true`): a photo from the library when one fits, else an AI image. */
export function PictureOption({
  checked,
  onChange,
  imageCost,
  label = "Add a picture",
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  imageCost: number;
  label?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox id={id} checked={checked} disabled={disabled} className="mt-0.5" onCheckedChange={(value) => onChange(value === true)} aria-describedby={`${id}-hint`} />
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium text-foreground">
          {label}
        </Label>
        <p id={`${id}-hint`} className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          A photo from your library when one fits, free; else an AI image <AiCostChip tokens={imageCost} />
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The writer on AI Posts                                                       */
/* -------------------------------------------------------------------------- */

type TopicChoice = "best" | "own";

/** A run's post in a few words ("Signs your water heater needs a flush…"). */
function excerpt(post: Post | null | undefined, max = 120): string | null {
  const text = (post?.event?.title || post?.summary || "").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function AiWriter({
  locationId,
  ai,
  initialKeyword,
  onReady,
  onOpenPost,
  className,
}: {
  locationId: string;
  /** `usePostAiState`: whether AI can run now, and the prices. */
  ai: PostAiState;
  /** Starts with this keyword chosen and as the topic (`?keyword=` from Keywords). */
  initialKeyword?: string | null;
  /** A run started here is done: open its draft (the page decides whether an editor is already open). */
  onReady: (post: Post, run: PostAiRun) => void;
  /** "Open it" on a finished run. */
  onOpenPost: (post: Post, run: PostAiRun) => void;
  className?: string;
}) {
  const seedKeyword = (initialKeyword?.trim() ?? "").slice(0, 80);
  const [choice, setChoice] = useState<TopicChoice>(seedKeyword.length >= AI_TOPIC_MIN ? "own" : "best");
  const [ownTopic, setOwnTopic] = useState(seedKeyword);
  const [ownType, setOwnType] = useState<PostType>("standard");
  const [instructions, setInstructions] = useState("");
  const [keywords, setKeywords] = useState<string[]>(seedKeyword.length >= 2 ? [seedKeyword] : []);
  const [tone, setTone] = useState<ToneChoice>("usual");
  const [cta, setCta] = useState<CtaChoice>("auto");
  const [picture, setPicture] = useState(false);
  const [runIds, setRunIds] = useState<string[]>([]);
  const [starting, setStarting] = useState<string | null>(null);
  const [declined, setDeclined] = useState<ApiError | null>(null);
  const starter = usePostRunStart();
  const facts = useAiFacts(locationId);
  const offersAllowed = facts.data?.offers.allowed ?? true;
  const ownId = useId();

  useOnRunEnd(locationId, runIds, (run) => {
    if (run.kind === "draft" && run.status === "done" && run.result?.post) onReady(run.result.post, run);
  });

  const blocked = !ai.canRun;
  const ownReady = ownTopic.trim().length >= AI_TOPIC_MIN;

  const inputFor = (topic: PostTopic | null): AiDraftInput => ({
    ...(topic ? { topic_id: topic.topic_id } : choice === "own" ? { topic: ownTopic.trim().slice(0, AI_TOPIC_MAX), type: ownType } : {}),
    ...(tone !== "usual" ? { tone } : {}),
    ...(cta !== "auto" ? { cta_type: cta } : {}),
    ...(keywords.length ? { keywords } : {}),
    ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
    ...(picture ? { image: true } : {}),
  });

  const write = async (topic: PostTopic | null) => {
    if (starting) return;
    const key = topic ? topic.topic_id : choice;
    setStarting(key);
    setDeclined(null);
    const input = inputFor(topic);
    const outcome = await starter.mutateAsync({
      start: () => aiDraftPost(locationId, input),
      fallback: "The post couldn't be started",
      onRetry: () => void write(topic),
    });
    setStarting(null);
    if (outcome.kind === "started" || outcome.kind === "busy") {
      const runId = outcome.run.run_id;
      setRunIds((ids) => [runId, ...ids.filter((id) => id !== runId)]);
      if (outcome.kind === "started" && outcome.existing) toast.info("This post is already being written", { description: "It shows below until it's ready." });
    } else if (outcome.kind === "inline") {
      setDeclined(outcome.error);
    }
  };

  const blockedNote = blocked && ai.state !== "checking" ? <AiStatusBanner compact status={ai} /> : null;

  return (
    <div className={cn("space-y-8", className)}>
      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-ai via-ai/70 to-primary" />
        <div className="space-y-5 p-4 pt-6 sm:p-6 sm:pt-7">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Write a post with AI</h3>
            <p className="text-sm text-muted-foreground">
              AI writes from your business's facts, checks the post and saves it as a draft. It can take a few minutes, and you can leave this page
              meanwhile. Nothing goes live until you say so.
            </p>
          </div>
          {blockedNote}

          <fieldset className="space-y-2.5">
            <legend className="mb-1.5 text-sm font-medium text-foreground">What should it be about?</legend>
            <SegmentedControl
              size="sm"
              aria-label="What the post is about"
              value={choice}
              onValueChange={setChoice}
              options={[
                { value: "best", label: "Best topic from your list" },
                { value: "own", label: "My own topic" },
              ]}
            />
            {choice === "best" ? (
              <p className="text-xs text-muted-foreground">AI takes the best topic waiting in your list below (and plans one first when none waits). Or pick one there.</p>
            ) : (
              <div className="space-y-2">
                <Input
                  id={ownId}
                  aria-label="Your topic"
                  placeholder="e.g. New evening appointments"
                  maxLength={AI_TOPIC_MAX}
                  value={ownTopic}
                  onChange={(event) => setOwnTopic(event.target.value)}
                />
                {ownTopic.trim().length > 0 && !ownReady ? <p className="text-xs text-muted-foreground">Write at least {AI_TOPIC_MIN} characters.</p> : null}
                <SegmentedControl
                  size="sm"
                  aria-label="Post type"
                  value={ownType}
                  onValueChange={setOwnType}
                  options={TYPES.map((type) => ({ ...type, disabled: type.value === "offer" && !offersAllowed }))}
                />
                {!offersAllowed ? <p className="text-xs text-muted-foreground">Offer posts aren't allowed for this business, so the AI writes updates and events.</p> : null}
              </div>
            )}
          </fieldset>

          <InstructionsField value={instructions} onChange={setInstructions} />

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full space-y-1.5 sm:w-auto">
              <p className="text-xs font-medium text-muted-foreground">Tone</p>
              <ToneSelect value={tone} onChange={setTone} />
            </div>
            <div className="w-full space-y-1.5 sm:w-auto">
              <p className="text-xs font-medium text-muted-foreground">Button</p>
              <CtaSelect value={cta} onChange={setCta} />
            </div>
          </div>

          <KeywordPicker locationId={locationId} value={keywords} onChange={setKeywords} showManageLink />
          <PictureOption checked={picture} onChange={setPicture} imageCost={ai.imageCost} />

          {declined ? <DeclinedNotice error={declined} locationId={locationId} /> : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            {blocked && ai.reason ? <p className="text-xs text-muted-foreground sm:mr-auto">{ai.reason}</p> : null}
            <Button
              type="button"
              variant="ai"
              disabled={blocked || starting !== null || (choice === "own" && !ownReady)}
              title={blocked ? ai.reason : choice === "own" && !ownReady ? `Write a topic of at least ${AI_TOPIC_MIN} characters` : undefined}
              onClick={() => void write(null)}
            >
              {starting === choice ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />} Write with AI
              <AiCostChip tokens={ai.draftCost} variant="inverse" />
            </Button>
          </div>

          <WriterRuns
            locationId={locationId}
            runIds={runIds}
            onStarted={(id) => setRunIds((ids) => [id, ...ids.filter((runId) => runId !== id)])}
            onDismissRun={(id) => setRunIds((ids) => ids.filter((runId) => runId !== id))}
            onOpenPost={onOpenPost}
          />
        </div>
      </div>

      <TopicsBacklog
        locationId={locationId}
        canEdit
        aiReason={blocked ? (ai.reason ?? "AI can't run right now.") : undefined}
        draftCost={ai.draftCost}
        writingTopicId={starting && starting !== "best" && starting !== "own" ? starting : null}
        onWrite={(topic) => void write(topic)}
      />
    </div>
  );
}

/**
 * The writer's runs: those started here (newest first), teammates' new drafts being written, and "Your post is
 * ready" for the viewer's drafts that finished while away (the last 24 hours, until dismissed).
 */
function WriterRuns({
  locationId,
  runIds,
  onStarted,
  onDismissRun,
  onOpenPost,
}: {
  locationId: string;
  runIds: readonly string[];
  /** "Try again" started a new run: the writer follows it like its own. */
  onStarted: (runId: string) => void;
  onDismissRun: (runId: string) => void;
  onOpenPost: (post: Post, run: PostAiRun) => void;
}) {
  // The page polls the location's active runs; this reads the same list.
  const active = useActivePostRuns(locationId, { enabled: false });
  const ready = useReadyRuns(locationId);
  const own = new Set(runIds);
  // New drafts being written that this writer didn't start: a teammate's, or one started in the post editor.
  const others = active.runs.filter((run) => run.kind === "draft" && !run.post_id && !own.has(run.run_id));
  // The viewer's drafts that finished while this page watched, then those of the last 24 hours.
  const listed = new Set<string>();
  const recent = [...active.ended, ...ready.runs].filter((run) => {
    if (own.has(run.run_id) || listed.has(run.run_id) || ready.dismissed.has(run.run_id) || !isReadyRun(run, ready.viewer)) return false;
    listed.add(run.run_id);
    return true;
  });
  const shownIds = runIds.filter((id) => !ready.dismissed.has(id));
  if (shownIds.length === 0 && others.length === 0 && recent.length === 0) return null;
  const dismiss = (runId: string) => {
    ready.dismiss(runId);
    onDismissRun(runId);
  };
  // "Try again" replaces the failed run with the new one.
  const retried = (oldId: string, newId: string) => {
    dismiss(oldId);
    onStarted(newId);
  };
  return (
    <section aria-label="Posts being written" className="space-y-2.5 border-t border-border pt-4">
      {shownIds.map((runId) => (
        <WatchedRun
          key={runId}
          locationId={locationId}
          runId={runId}
          inList={active.runs.some((run) => run.run_id === runId)}
          onOpenPost={onOpenPost}
          onDismiss={() => dismiss(runId)}
          onRetried={(newId) => retried(runId, newId)}
        />
      ))}
      {others.map((run) => (
        <RunProgress key={run.run_id} run={run} />
      ))}
      {recent.map((run) => (
        <RunRow key={run.run_id} locationId={locationId} run={run} onOpenPost={onOpenPost} onDismiss={() => dismiss(run.run_id)} onRetried={(newId) => retried(run.run_id, newId)} />
      ))}
    </section>
  );
}

function WatchedRun({
  locationId,
  runId,
  inList,
  onOpenPost,
  onDismiss,
  onRetried,
}: {
  locationId: string;
  runId: string;
  inList: boolean;
  onOpenPost: (post: Post, run: PostAiRun) => void;
  onDismiss: () => void;
  onRetried: (runId: string) => void;
}) {
  const { run, gone } = useAiRun(locationId, runId, { poll: !inList });
  if (gone || !run) return null;
  return <RunRow locationId={locationId} run={run} onOpenPost={onOpenPost} onDismiss={onDismiss} onRetried={onRetried} />;
}

/** One "Write with AI" run: working, ready ("Open it"), or failed ("Try again"). */
function RunRow({
  locationId,
  run,
  onOpenPost,
  onDismiss,
  onRetried,
}: {
  locationId: string;
  run: PostAiRun;
  onOpenPost: (post: Post, run: PostAiRun) => void;
  onDismiss: () => void;
  onRetried: (runId: string) => void;
}) {
  const starter = usePostRunStart();
  const invalidate = useInvalidatePosts(locationId);
  const toastError = useToastPostError();
  const [using, setUsing] = useState(false);
  if (runIsActive(run)) return <RunProgress run={run} />;

  if (run.status === "failed") {
    const restart = retryStartOf(locationId, run);
    return (
      <RunFailure
        run={run}
        locationId={locationId}
        fallback="Your post couldn't be written"
        onRetry={
          restart && !starter.isPending
            ? () =>
                void starter.mutateAsync({ start: restart, fallback: "The post couldn't be started" }).then((outcome) => {
                  if (outcome.kind === "started" || outcome.kind === "busy") onRetried(outcome.run.run_id);
                })
            : undefined
        }
        onDismiss={onDismiss}
      />
    );
  }
  if (run.kind !== "draft" || run.status !== "done") return null;
  const shown = run;
  const post = shown.result?.post ?? null;
  const applyPicture = async (media: PostMediaDetails) => {
    if (!post) return;
    setUsing(true);
    try {
      await updatePost(locationId, post.post_id, { media_ids: [media.media_id] });
      invalidate();
      toast.success("The picture is on the post.");
    } catch (err) {
      toastError(err, "The picture couldn't be added.");
    } finally {
      setUsing(false);
    }
  };
  return (
    <div className="rounded-lg border border-ai/25 bg-card px-3 py-2.5 shadow-xs">
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            <RunDoneBadge run={shown} /> {post ? "Your post is ready" : "Your post was written, then deleted"}
          </p>
          {post ? <p className="line-clamp-2 text-sm text-muted-foreground">{excerpt(post)}</p> : null}
        </div>
        {post ? (
          <Button type="button" size="sm" onClick={() => onOpenPost(post, shown)}>
            <ExternalLink aria-hidden /> Open it
          </Button>
        ) : null}
        <DismissButton onDismiss={onDismiss} />
      </div>
      <RunNotes locationId={locationId} run={shown} onUsePicture={post ? (media) => void applyPicture(media) : undefined} usingPicture={using} className="mt-2.5" />
    </div>
  );
}
