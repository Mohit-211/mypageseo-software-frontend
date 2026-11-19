/**
 * The post editor's AI panel (post writer v2, background runs; 2026-11-16 "Post writer v2", 2026-11-17 §1).
 *
 * - `mode="write"`: the post has no text (a new post, or a draft started by hand): "Write with AI" fills it. The
 *   topic is the best waiting topic of the plan, one of the "Post ideas" (`ai-topics`, free), or the user's own.
 * - `mode="change"`: the post has text and isn't on Google: "Change it", as asked or (without instructions) a
 *   clearly different version on the same topic, optionally with a new picture.
 *
 * The editor does the rest: it saves the form first when it must, starts the run, shows its progress and locks
 * the fields the AI writes until it ends.
 */
import { useId, useState } from "react";
import { toast } from "sonner";
import { Lightbulb, LoaderCircle, PenLine, Sparkles, X } from "lucide-react";
import { aiPostTopics, type AiDraftInput, type AiReviseInput, type PostTopic, type PostType } from "@/api";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { AiStatusBanner } from "@/components/ai/ai-status-banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { runErrorFrom, runFromConflict, runIsActive, useAiRun, useNoteRunStarted } from "@/lib/posts/ai-runs";
import type { PostAiState } from "@/lib/posts/post-ai-state";
import { POST_TYPE_LABEL } from "@/lib/posts/post-format";
import { useToastPostError } from "@/lib/posts/post-toasts";
import { FOCUS_MAX, IDEAS_COUNT, topicReasonLabels } from "@/lib/posts/topics";
import { useOnRunEnd } from "@/lib/posts/use-post-runs";
import { AI_TOPIC_MAX, AI_TOPIC_MIN } from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";
import { InstructionsField, KeywordPicker, PictureOption, ToneSelect, type ToneChoice } from "./ai-writer";
import { RunProgress } from "./run-status";

type Choice = "best" | "idea" | "own";

export function EditorAiPanel({
  locationId,
  ai,
  mode,
  defaultOpen = false,
  starting = false,
  locked = false,
  type,
  savesFirst = false,
  onWrite,
  onChange,
}: {
  locationId: string;
  ai: PostAiState;
  mode: "write" | "change";
  defaultOpen?: boolean;
  /** The editor is saving or starting the run. */
  starting?: boolean;
  /** A run holds the post: nothing new can start. */
  locked?: boolean;
  /** The editor's post type (a typed topic is written as this type). */
  type: PostType;
  /** The form has changes the editor saves before the AI starts. */
  savesFirst?: boolean;
  onWrite: (input: AiDraftInput) => void;
  onChange: (input: AiReviseInput) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [choice, setChoice] = useState<Choice>("best");
  const [ownTopic, setOwnTopic] = useState("");
  const [idea, setIdea] = useState<PostTopic | null>(null);
  const [ideas, setIdeas] = useState<PostTopic[]>([]);
  const [focus, setFocus] = useState("");
  const [fetchingIdeas, setFetchingIdeas] = useState(false);
  const [ideasRunId, setIdeasRunId] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [tone, setTone] = useState<ToneChoice>("usual");
  const [picture, setPicture] = useState(false);
  const noteRun = useNoteRunStarted();
  const toastError = useToastPostError();
  const ideasRun = useAiRun(locationId, ideasRunId);
  const ownId = useId();
  const ideasId = useId();

  useOnRunEnd(locationId, [ideasRunId], (run) => {
    if (run.kind !== "plan") return;
    if (run.status === "done" && run.result) {
      const fresh = run.result.topics;
      setIdeas((current) => [...fresh, ...current.filter((topic) => !fresh.some((entry) => entry.topic_id === topic.topic_id))]);
      if (fresh.length === 0) toast.info("No new ideas this time", { description: "Pick one below, or type your own topic." });
    } else if (run.status === "failed") {
      // The same words as that error at once (AI reasons through the AI copy deck, run-end codes in the posts'
      // words), never the backend's own message.
      toastError(runErrorFrom(run) ?? new Error("plan failed"), "The ideas couldn't be planned");
    }
  });

  const blocked = !ai.canRun;
  const busy = starting || locked;

  const getIdeas = async () => {
    setFetchingIdeas(true);
    try {
      const text = focus.trim().slice(0, FOCUS_MAX);
      const answer = await aiPostTopics(locationId, { count: IDEAS_COUNT, ...(text ? { focus: text } : {}) });
      setIdeas(answer.topics);
      if (answer.run) {
        noteRun(answer.run);
        setIdeasRunId(answer.run.run_id);
      } else if (answer.topics.length === 0) {
        toast.info("No ideas waiting", { description: "Type your own topic, or try again in a moment." });
      }
    } catch (error) {
      const held = runFromConflict(error);
      if (held) {
        noteRun(held);
        setIdeasRunId(held.run_id);
      } else {
        toastError(error, "The ideas couldn't be found");
      }
    } finally {
      setFetchingIdeas(false);
    }
  };

  const ownReady = ownTopic.trim().length >= AI_TOPIC_MIN;
  const writeReady = choice === "best" || (choice === "idea" && idea !== null) || (choice === "own" && ownReady);

  const write = () =>
    onWrite({
      ...(choice === "idea" && idea ? { topic_id: idea.topic_id } : choice === "own" ? { topic: ownTopic.trim().slice(0, AI_TOPIC_MAX), type } : {}),
      ...(tone !== "usual" ? { tone } : {}),
      ...(keywords.length ? { keywords } : {}),
      ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
      ...(picture ? { image: true } : {}),
    });

  const change = () =>
    onChange({
      ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
      image: picture ? "new" : "keep",
    });

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-dashed border-ai/30 bg-ai-surface/60 px-3 py-2.5">
        <Button type="button" variant="ai" size="sm" disabled={blocked || busy} title={ai.reason} onClick={() => setOpen(true)}>
          {mode === "write" ? <Sparkles aria-hidden /> : <PenLine aria-hidden />} {mode === "write" ? "Write with AI" : "Change it with AI"}
        </Button>
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          {blocked && ai.reason
            ? ai.reason
            : mode === "write"
              ? "AI writes this post from your business's facts and saves it. It can take a few minutes."
              : "Ask for a change, or get a fresh version on the same topic. It can take a few minutes."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-ai/25 bg-ai-surface/50 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles aria-hidden className="size-4 text-ai" /> {mode === "write" ? "Write with AI" : "Change it with AI"}
        </p>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Close the AI panel" onClick={() => setOpen(false)}>
          <X aria-hidden />
        </Button>
      </div>
      {blocked && ai.state !== "checking" ? <AiStatusBanner compact status={ai} /> : null}

      {mode === "write" ? (
        <fieldset className="space-y-2.5">
          <legend className="mb-1.5 text-sm font-medium text-foreground">What should it be about?</legend>
          <SegmentedControl
            size="sm"
            aria-label="What the post is about"
            value={choice}
            onValueChange={setChoice}
            options={[
              { value: "best", label: "Best topic" },
              { value: "idea", label: "Pick an idea" },
              { value: "own", label: "My own" },
            ]}
          />
          {choice === "best" ? (
            <p className="text-xs text-muted-foreground">AI takes the best topic waiting in your plan, and plans one first when none waits.</p>
          ) : choice === "own" ? (
            <div className="space-y-1">
              <Input
                id={ownId}
                aria-label="Your topic"
                placeholder={`e.g. New evening appointments (written as an ${POST_TYPE_LABEL[type].toLowerCase()})`}
                maxLength={AI_TOPIC_MAX}
                value={ownTopic}
                onChange={(event) => setOwnTopic(event.target.value)}
              />
              {ownTopic.trim().length > 0 && !ownReady ? <p className="text-xs text-muted-foreground">Write at least {AI_TOPIC_MIN} characters.</p> : null}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  aria-label="Focus for the ideas (optional)"
                  placeholder="Focus (optional), e.g. winter specials"
                  maxLength={FOCUS_MAX}
                  value={focus}
                  onChange={(event) => setFocus(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !fetchingIdeas && !blocked) {
                      event.preventDefault();
                      void getIdeas();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 text-ai hover:border-ai/40 hover:bg-ai-surface hover:text-ai"
                  disabled={fetchingIdeas || blocked || runIsActive(ideasRun.run)}
                  title={ai.reason}
                  onClick={() => void getIdeas()}
                >
                  {fetchingIdeas ? <LoaderCircle aria-hidden className="animate-spin" /> : <Lightbulb aria-hidden />} {ideas.length ? "More ideas" : "Get post ideas"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Ideas are free. They come from your business's facts, the season and your keywords, and never repeat.</p>
              {ideasRun.run && runIsActive(ideasRun.run) ? <RunProgress run={ideasRun.run} /> : null}
              {ideas.length ? (
                // A real radio group: one tab stop, arrow keys move between the ideas.
                <RadioGroup
                  aria-label="Post ideas"
                  value={idea?.topic_id ?? ""}
                  onValueChange={(value) => setIdea(ideas.find((topic) => topic.topic_id === value) ?? null)}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {ideas.map((topic) => {
                    const selected = idea?.topic_id === topic.topic_id;
                    const reasons = topicReasonLabels(topic.reasons);
                    const itemId = `${ideasId}-${topic.topic_id}`;
                    const facts = [topic.angle_label, topic.type !== "standard" ? POST_TYPE_LABEL[topic.type] : null, topic.keyword].filter(Boolean).join(" · ");
                    return (
                      <label
                        key={topic.topic_id}
                        htmlFor={itemId}
                        className={cn(
                          "flex h-full cursor-pointer items-start gap-2.5 rounded-lg border bg-card p-3 transition-colors",
                          selected ? "border-ai ring-1 ring-ai/30" : "border-border hover:border-ai/35",
                        )}
                      >
                        <RadioGroupItem id={itemId} value={topic.topic_id} aria-labelledby={`${itemId}-title`} aria-describedby={`${itemId}-facts`} className="mt-0.5" />
                        <span className="flex min-w-0 flex-col gap-1">
                          <span id={`${itemId}-title`} className="text-sm font-semibold text-foreground">
                            {topic.title}
                          </span>
                          <span id={`${itemId}-facts`} className="flex flex-col gap-1 text-xs text-muted-foreground">
                            {facts ? <span>{facts}</span> : null}
                            {reasons.length ? <span>Why: {reasons.join(" · ")}</span> : null}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              ) : null}
            </div>
          )}
        </fieldset>
      ) : null}

      <InstructionsField
        value={instructions}
        onChange={setInstructions}
        {...(mode === "change"
          ? {
              label: "What should change? (optional)",
              placeholder: "e.g. Shorter, and mention the free parking",
              hint: "Leave it empty for a clearly different version on the same topic. Phone numbers, links, hashtags and emoji are left out.",
            }
          : {})}
      />

      {mode === "write" ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full space-y-1.5 sm:w-auto">
            <p className="text-xs font-medium text-muted-foreground">Tone</p>
            <ToneSelect value={tone} onChange={setTone} />
          </div>
        </div>
      ) : null}
      {mode === "write" ? <KeywordPicker locationId={locationId} value={keywords} onChange={setKeywords} /> : null}
      {mode === "write" ? (
        <PictureOption checked={picture} onChange={setPicture} imageCost={ai.imageCost} />
      ) : (
        <ChangePictureOption checked={picture} onChange={setPicture} imageCost={ai.imageCost} />
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {savesFirst ? <p className="text-xs text-muted-foreground sm:mr-auto">Your changes are saved first.</p> : null}
        <Button
          type="button"
          variant="ai"
          disabled={blocked || busy || (mode === "write" && !writeReady)}
          title={blocked ? ai.reason : locked ? "Wait for the AI to finish" : undefined}
          onClick={mode === "write" ? write : change}
        >
          {starting ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />} {mode === "write" ? "Write with AI" : "Change it"}
          <AiCostChip tokens={ai.draftCost} variant="inverse" />
        </Button>
      </div>
    </div>
  );
}

/** "Make a new picture too" for Change it (`image: "new"`; a picture that can't be made keeps the old one). */
export function ChangePictureOption({ checked, onChange, imageCost }: { checked: boolean; onChange: (checked: boolean) => void; imageCost: number }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox id={id} checked={checked} className="mt-0.5" onCheckedChange={(value) => onChange(value === true)} aria-describedby={`${id}-hint`} />
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium text-foreground">
          Make a new picture too
        </Label>
        <div id={`${id}-hint`} className="space-y-1 text-xs text-muted-foreground">
          <p className="flex flex-wrap items-center gap-1.5">
            A photo from your library when one fits, free; else an AI image <AiCostChip tokens={imageCost} />
          </p>
          <p>If no picture can be made, the old one stays.</p>
        </div>
      </div>
    </div>
  );
}
