import { useId, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Check, ImageIcon, Lightbulb, LoaderCircle, RotateCw, ShieldCheck, Sparkles, Tag, X } from "lucide-react";
import { aiDraftPost, aiPostTopics, type AiPostDraft, type AiPostTopic, type PostTone, type PostType } from "@/api";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { AiStatusBanner } from "@/components/ai/ai-status-banner";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { noteAiSuccess } from "@/lib/ai/ai-signal";
import { useAiStatus } from "@/lib/ai/ai-status";
import { POST_TYPE_LABEL } from "@/lib/posts/post-format";
import type { AiDraftContext } from "@/lib/posts/post-seed";
import { useToastPostError } from "@/lib/posts/post-toasts";
import { quoteList, sameKeyword } from "@/lib/keywords/keywords";
import { keywordsPath } from "@/lib/keywords/paths";
import { KEYWORD_USAGE } from "@/lib/keywords/usage-rules";
import { AI_TOPIC_MIN, MAX_DRAFT_KEYWORDS, TONE_LABEL, useInvalidateTokens } from "@/lib/posts/use-posts";
import { useTracking } from "@/lib/rankings/use-rankings";
import { cn } from "@/lib/utils";

const TOPIC_MAX = 300;
const FOCUS_MAX = 200;
// A compact text link in the keyword row; the ::after pads its touch target to 40px without moving the row.
const KEYWORDS_LINK_CLASS = "relative h-8 px-1.5 after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']";
const TYPES: { value: PostType; label: string }[] = (["standard", "event", "offer"] as const).map((value) => ({ value, label: POST_TYPE_LABEL[value] }));

type WriteInput = AiDraftContext & { tone: PostTone; variants: number; avoid?: string[] };

/** The topic an idea is written from (its title and angle). */
const ideaTopic = (idea: AiPostTopic) => (idea.angle ? `${idea.topic}: ${idea.angle}` : idea.topic).trim().slice(0, TOPIC_MAX);

/** New versions arrive below the fold: bring them into view once, when they mount. */
function revealDrafts(element: HTMLElement | null) {
  if (!element) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
}

/**
 * AI writing (Phase 22): "Suggest ideas" gives topic cards for this business (its facts, tracked
 * keywords, the season and upcoming holidays); "Write" turns a topic into 1–3 versions in the
 * location's own voice, weaving in up to 3 tracked keywords; "Redo" asks for clearly different ones.
 * Drafts carry Google's post-rule checks as guidance. Nothing is saved: `onPick` hands a version on.
 *
 * - `layout="page"` (AI Posts): an always-open, numbered three-step panel; the writer keeps its own
 *   post type, and its ideas and drafts stay while the editor opens and closes.
 * - `layout="inline"` (inside the post editor): a "Write with AI" button that opens a compact panel;
 *   the editor owns the post type (`type` + `onTypeChange`).
 *
 * AI buttons follow `useAiStatus`: when AI can't run they stay visible, disabled, with the reason.
 */
export function AiWriter({
  locationId,
  layout = "inline",
  defaultOpen = false,
  type: controlledType,
  lodging = false,
  onTypeChange,
  onPick,
  initialKeyword,
  className,
}: {
  locationId: string;
  layout?: "inline" | "page";
  /** Inline only: start open. */
  defaultOpen?: boolean;
  /** The post type to write for (inline: the editor's). Without it the writer keeps its own. */
  type?: PostType;
  /** Google doesn't allow Offer posts for lodging: an Offer idea is written as an update. */
  lodging?: boolean;
  onTypeChange?: (type: PostType) => void;
  onPick: (draft: AiPostDraft, context: AiDraftContext) => void;
  /** Starts with this keyword chosen and the topic filled in (`?keyword=` from the Keywords page). */
  initialKeyword?: string | null;
  className?: string;
}) {
  const ai = useAiStatus(locationId);
  const toastError = useToastPostError();
  const invalidateTokens = useInvalidateTokens();
  const tracking = useTracking(locationId);
  // In the saved order, which is the AI's priority.
  const tracked = tracking.data?.tracking.keywords.map((keyword) => keyword.text) ?? [];
  const noneTracked = tracking.isSuccess && tracked.length === 0;
  // What a draft weaves in when no keyword is picked (sliced first, so quoteList never adds "and N more").
  const defaultKeywords = tracked.slice(0, KEYWORD_USAGE.postDefaultCount);
  // `ai-draft` takes keywords of 2–80 characters.
  const seedKeyword = (initialKeyword?.trim() ?? "").slice(0, 80);
  const page = layout === "page";
  const topicId = useId();

  const [open, setOpen] = useState(page || defaultOpen);
  const [focus, setFocus] = useState(seedKeyword);
  const [ideas, setIdeas] = useState<AiPostTopic[]>([]);
  const [topic, setTopic] = useState(seedKeyword);
  const [keywords, setKeywords] = useState<string[]>(seedKeyword.length >= 2 ? [seedKeyword] : []);
  const [tone, setTone] = useState<PostTone>("friendly");
  const [variants, setVariants] = useState("2");
  const [ownType, setOwnType] = useState<PostType>("standard");
  const [drafts, setDrafts] = useState<{ items: AiPostDraft[]; context: AiDraftContext; batch: number } | null>(null);
  const type = controlledType ?? ownType;
  const setType = (next: PostType) => {
    onTypeChange?.(next);
    if (controlledType === undefined) setOwnType(next);
  };

  const suggest = useMutation({
    mutationFn: (focusText: string) => aiPostTopics(locationId, { count: 6, ...(focusText ? { focus: focusText } : {}) }),
    onSuccess: (result) => {
      setIdeas(result.topics);
      noteAiSuccess();
      invalidateTokens();
    },
    onError: (error) => toastError(error, "The ideas couldn't be suggested"),
  });

  const write = useMutation({
    mutationFn: (input: WriteInput) =>
      aiDraftPost(locationId, {
        topic: input.topic,
        tone: input.tone,
        type: input.type,
        variants: input.variants,
        ...(input.keywords.length ? { keywords: input.keywords } : {}),
        ...(input.avoid?.length ? { avoid: input.avoid } : {}),
      }),
    onSuccess: (result, input) => {
      setDrafts((previous) => ({
        items: result.drafts,
        context: { type: input.type, topic: input.topic, keywords: input.keywords },
        batch: (previous?.batch ?? 0) + 1,
      }));
      noteAiSuccess();
      invalidateTokens();
    },
    onError: (error) => toastError(error, "The post couldn't be written"),
  });

  const busy = suggest.isPending || write.isPending;
  const blocked = !ai.canRun;
  const topicReady = topic.trim().length >= AI_TOPIC_MIN;

  const writeTopic = (input: AiDraftContext, avoid?: string[]) =>
    write.mutate({ ...input, topic: input.topic.trim().slice(0, TOPIC_MAX), tone, variants: Number(variants), ...(avoid ? { avoid } : {}) });

  const pickIdea = (idea: AiPostTopic) => {
    const nextType = idea.type === "offer" && lodging ? "standard" : idea.type;
    const nextKeywords = idea.keywords.slice(0, MAX_DRAFT_KEYWORDS);
    const nextTopic = ideaTopic(idea);
    setTopic(nextTopic);
    setKeywords(nextKeywords);
    setType(nextType);
    writeTopic({ topic: nextTopic, type: nextType, keywords: nextKeywords });
  };

  const addKeyword = (value: string) => {
    if (keywords.length >= MAX_DRAFT_KEYWORDS || keywords.some((keyword) => sameKeyword(keyword, value))) return;
    setKeywords([...keywords, value]);
  };
  const available = tracked.filter((keyword) => !keywords.some((chosen) => sameKeyword(chosen, keyword)));

  if (!open) {
    return (
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-dashed border-ai/30 bg-ai-surface/60 px-3 py-2.5", className)}>
        <Button type="button" variant="ai" size="sm" disabled={blocked} title={ai.reason} onClick={() => setOpen(true)}>
          <Sparkles aria-hidden /> Write with AI
        </Button>
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          {blocked && ai.reason ? ai.reason : "Get ideas and drafts in your own voice, with your keywords woven in."}
        </p>
      </div>
    );
  }

  const ideasStep = (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="What should the ideas focus on? (optional)"
          placeholder="Focus (optional), e.g. winter specials"
          maxLength={FOCUS_MAX}
          value={focus}
          onChange={(event) => setFocus(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !busy && !blocked) suggest.mutate(focus.trim());
          }}
        />
        <Button type="button" variant="ai" className="shrink-0" disabled={busy || blocked} title={ai.reason} onClick={() => suggest.mutate(focus.trim())}>
          {suggest.isPending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Lightbulb aria-hidden />}
          {suggest.isPending ? "Thinking…" : ideas.length ? "More ideas" : "Suggest ideas"}
          <AiCostChip item="post_topics" locationId={locationId} variant="inverse" />
        </Button>
      </div>
      {ideas.length > 0 ? (
        <ul className={cn("grid gap-3", page ? "md:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2")}>
          {ideas.map((idea) => (
            <li key={idea.topic} className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-ai/35">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold leading-snug text-foreground">{idea.topic}</h4>
                {idea.type !== "standard" ? (
                  <StatusBadge tone="info" size="sm">
                    {POST_TYPE_LABEL[idea.type]}
                  </StatusBadge>
                ) : null}
              </div>
              {idea.angle ? <p className="mt-1 text-sm text-muted-foreground">{idea.angle}</p> : null}
              {idea.keywords.length ? (
                <p className="mt-2.5 flex flex-wrap gap-1">
                  {idea.keywords.map((keyword) => (
                    <Badge key={keyword} variant="neutral" size="sm">
                      <Tag aria-hidden /> {keyword}
                    </Badge>
                  ))}
                </p>
              ) : null}
              {idea.why ? <p className="mt-2.5 text-xs text-muted-foreground">{idea.why}</p> : null}
              <div className="mt-auto pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-ai hover:border-ai/40 hover:bg-ai-surface hover:text-ai"
                  disabled={busy || blocked}
                  title={ai.reason}
                  onClick={() => pickIdea(idea)}
                >
                  {write.isPending && write.variables?.topic === ideaTopic(idea) ? (
                    <LoaderCircle aria-hidden className="animate-spin" />
                  ) : (
                    <Sparkles aria-hidden />
                  )}{" "}
                  {write.isPending && write.variables?.topic === ideaTopic(idea) ? "Writing…" : "Write this post"}
                  <AiCostChip item="post_draft" locationId={locationId} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : page ? (
        <p className="rounded-lg bg-surface-strong px-3 py-2.5 text-sm text-muted-foreground">
          Ideas use your business details, your tracked keywords, the season and upcoming holidays, and skip topics you've posted about recently.
        </p>
      ) : null}
    </div>
  );

  const writeStep = (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {page ? <WriterLabel htmlFor={topicId}>Topic</WriterLabel> : null}
        <Input
          id={topicId}
          aria-label={page ? undefined : "Topic"}
          placeholder={page ? "e.g. new evening appointments" : "Or type your own topic, e.g. new evening appointments"}
          maxLength={TOPIC_MAX}
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
        />
        {topic.trim().length > 0 && !topicReady ? <p className="text-xs text-muted-foreground">Write at least {AI_TOPIC_MIN} characters.</p> : null}
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Keywords to weave in ({keywords.length}/{MAX_DRAFT_KEYWORDS}):
          </span>
          {keywords.map((keyword) => (
            <Badge key={keyword} variant="brand" className="gap-1 pr-1">
              {keyword}
              <button
                type="button"
                aria-label={`Remove ${keyword}`}
                className="grid size-5 cursor-pointer place-items-center rounded-full outline-hidden hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setKeywords(keywords.filter((item) => item !== keyword))}
              >
                <X className="size-3" aria-hidden />
              </button>
            </Badge>
          ))}
          {keywords.length < MAX_DRAFT_KEYWORDS && available.length > 0 ? (
            <Select value="" onValueChange={addKeyword}>
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
          ) : keywords.length === 0 && noneTracked ? (
            <span className="text-xs text-muted-foreground">None tracked yet. Without keywords, AI writes from your business details.</span>
          ) : null}
          {/* Only on AI Posts: inside the post editor's dialog, leaving would drop the unsaved post. */}
          {page && (noneTracked || tracked.length > 0) ? (
            <Button asChild variant="link" size="sm" className={KEYWORDS_LINK_CLASS}>
              <Link to={keywordsPath(locationId)}>
                {noneTracked ? "Add keywords" : "Manage keywords"} <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>
        {/* With no pick, the backend weaves in the first tracked keywords (`keywordsToUse`): say which. */}
        {keywords.length === 0 && defaultKeywords.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            If you pick none, AI uses {defaultKeywords.length > 1 ? `your first ${defaultKeywords.length}: ` : ""}
            {quoteList(defaultKeywords)}.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {page ? <SegmentedControl size="sm" aria-label="Post type" value={type} onValueChange={setType} options={TYPES} /> : null}
        <Select value={tone} onValueChange={(value) => setTone(value as PostTone)}>
          <SelectTrigger className="w-40" aria-label="Tone">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TONE_LABEL) as PostTone[]).map((value) => (
              <SelectItem key={value} value={value}>
                {TONE_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={variants} onValueChange={setVariants}>
          <SelectTrigger className="w-32" aria-label="Versions">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["1", "2", "3"].map((value) => (
              <SelectItem key={value} value={value}>
                {value} version{value === "1" ? "" : "s"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ai"
          disabled={busy || blocked || !topicReady}
          title={blocked ? ai.reason : !topicReady ? `Write a topic of at least ${AI_TOPIC_MIN} characters` : undefined}
          onClick={() => writeTopic({ topic, type, keywords })}
        >
          {write.isPending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
          {write.isPending ? "Writing…" : "Write"}
          <AiCostChip item="post_draft" locationId={locationId} variant="inverse" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Versions match the style of your earlier posts. One price covers all versions.</p>
    </div>
  );

  const draftsStep = drafts ? (
    <div key={drafts.batch} ref={revealDrafts} className="scroll-mt-24 space-y-3">
      <ul className={cn("grid gap-3", page && drafts.items.length > 1 ? "lg:grid-cols-2" : "")}>
        {drafts.items.map((draft, index) => (
          <DraftCard key={`${index}-${draft.summary.slice(0, 24)}`} draft={draft} index={index} onPick={() => onPick(draft, drafts.context)} />
        ))}
      </ul>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-ai hover:bg-ai-surface hover:text-ai"
        disabled={busy || blocked}
        title={ai.reason}
        onClick={() => writeTopic(drafts.context, drafts.items.map((draft) => draft.summary).slice(0, 6))}
      >
        {write.isPending ? <LoaderCircle aria-hidden className="animate-spin" /> : <RotateCw aria-hidden />} Redo: different versions
        <AiCostChip item="post_draft" locationId={locationId} />
      </Button>
    </div>
  ) : null;

  const blockedNote = blocked && ai.state !== "checking" ? <AiStatusBanner compact status={ai} /> : null;

  if (page) {
    return (
      <div className={cn("relative overflow-hidden rounded-xl border border-border bg-card shadow-card", className)}>
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-ai via-ai/70 to-primary" />
        <ol className="space-y-7 p-4 pt-6 sm:p-6 sm:pt-7">
          <Step number={1} title="Get post ideas" description="Fresh, timely topics for this business. Pick one and AI writes it.">
            {ideasStep}
          </Step>
          <Step number={2} title="Or write about your own topic" description="Describe it in a few words; AI writes the post in your voice.">
            {writeStep}
          </Step>
          {draftsStep ? (
            <Step number={3} title="Pick a version" description="It opens in the editor, where you can change it, add a photo and schedule it.">
              {draftsStep}
            </Step>
          ) : null}
        </ol>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 rounded-xl border border-ai/25 bg-ai-surface/50 p-3 sm:p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles aria-hidden className="size-4 text-ai" /> Write with AI
        </p>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Close the AI writer" onClick={() => setOpen(false)}>
          <X aria-hidden />
        </Button>
      </div>
      {blockedNote}
      {ideasStep}
      <div className="border-t border-ai/15 pt-3">{writeStep}</div>
      {draftsStep}
    </div>
  );
}

function WriterLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
      {children}
    </Label>
  );
}

function Step({ number, title, description, children }: { number: number; title: string; description: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <li aria-labelledby={headingId} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 sm:gap-x-4">
      <span aria-hidden className="grid size-7 place-items-center rounded-full bg-ai-surface text-sm font-semibold text-ai ring-1 ring-inset ring-ai/25">
        {number}
      </span>
      <div className="min-w-0 pt-0.5">
        <h3 id={headingId} className="text-[15px] font-semibold leading-6 text-foreground">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">{children}</div>
    </li>
  );
}

function DraftCard({ draft, index, onPick }: { draft: AiPostDraft; index: number; onPick: () => void }) {
  const ok = draft.compliant !== false && !draft.duplicate_risk;
  return (
    <li className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-border bg-card p-4 shadow-xs">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Version {index + 1}</p>
      {draft.event_title ? <p className="font-semibold text-foreground">{draft.event_title}</p> : null}
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{draft.summary}</p>
      {draft.image_idea ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <ImageIcon aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>Picture idea: {draft.image_idea}</span>
        </p>
      ) : null}
      {draft.compliant === false ? (
        <p className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning-surface px-2.5 py-2 text-xs text-warning-foreground">
          <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>
            This version may break Google's post rules:{" "}
            {(draft.warnings ?? []).map((warning) => warning.message.replace(/[.\s]+$/, "")).join("; ") || "see the notes in the editor"}. Change it, or ask
            for different versions.
          </span>
        </p>
      ) : null}
      {draft.duplicate_risk ? (
        <p className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning-surface px-2.5 py-2 text-xs text-warning-foreground">
          <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>Too close to an earlier post. Google treats repeats as spam.</span>
        </p>
      ) : null}
      {ok ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-success">
          <ShieldCheck aria-hidden className="size-3.5 shrink-0" /> Follows Google's post rules
        </p>
      ) : null}
      <div className="mt-auto pt-1">
        <Button type="button" size="sm" onClick={onPick}>
          <Check aria-hidden /> Use this version
        </Button>
      </div>
    </li>
  );
}
