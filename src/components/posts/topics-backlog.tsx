/**
 * Post topics on AI Posts (Phase 25c; 2026-11-16 "Post topics", 2026-11-17 section 1): the location's backlog of
 * planned topics, best first, with each topic's angle, pillar, keyword and why it was planned; the topics being
 * written, used recently and dismissed; the suggestions to add an offer or an event (AI Settings #facts);
 * Dismiss / Restore; "Plan more" with an optional focus (200 when the list is full, else a plan run); and "Write
 * this post" on a topic. Planning is free: no token chip on it.
 *
 * Client users read the list only: no planning, no suggestions (adding an offer or an event is their agency's to do).
 * `heading={false}` leaves the heading to the page (AI Posts' read-only view has its own section header).
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, CalendarDays, Lightbulb, LoaderCircle, RotateCcw, Sparkles, Tag, X } from "lucide-react";
import { isRunStart, planPostTopics, type PlanTopicsAnswer, type PostAiRun, type PostTopic, type PostTopicsList } from "@/api";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { ErrorState, ListSkeleton } from "@/components/layout/shared/feedback/states";
import { FilterChips } from "@/components/layout/shared/filter-chips";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { locationPath } from "@/lib/mypageseo/section-links";
import { postTopicsKey, runFromConflict, runIsActive, useActivePostRuns, useAiRun, useNoteRunStarted } from "@/lib/posts/ai-runs";
import { POST_TYPE_LABEL } from "@/lib/posts/post-format";
import { useToastPostError } from "@/lib/posts/post-toasts";
import { BACKLOG_MAX, FOCUS_MAX, suggestionLinkText, topicErrorText, topicReasonLabels, topicTimingText, usePostTopics, useTopicStatus } from "@/lib/posts/topics";
import { useOnRunEnd } from "@/lib/posts/use-post-runs";
import { postErrorText } from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";
import { RunFailure, RunProgress } from "./run-status";

type TopicView = "backlog" | "reserved" | "used" | "dismissed";

/** The list without the plan answer's extra fields (`planned`, `backlog_full`). */
function listOf(answer: Exclude<PlanTopicsAnswer, { run: unknown }>): PostTopicsList {
  const { planned: _planned, backlog_full: _full, ...list } = answer;
  return list;
}

export function TopicsBacklog({
  locationId,
  canEdit,
  heading = true,
  aiReason,
  draftCost,
  writingTopicId = null,
  onWrite,
  className,
}: {
  locationId: string;
  /** Owners and members: Write, Dismiss, Restore, Plan more, and the suggestions to add an offer or an event. */
  canEdit: boolean;
  /** Its own "Post topics" heading; false when the page's section header already says it. */
  heading?: boolean;
  /** Why AI can't run now (Write and Plan more are disabled with it); undefined when it can. */
  aiReason?: string | undefined;
  /** The price of one "Write with AI" (`post_draft`). */
  draftCost: number;
  /** The topic whose "Write this post" is starting. */
  writingTopicId?: string | null;
  onWrite?: (topic: PostTopic) => void;
  className?: string;
}) {
  const topics = usePostTopics(locationId);
  const status = useTopicStatus(locationId);
  const queryClient = useQueryClient();
  const noteRun = useNoteRunStarted();
  const toastError = useToastPostError();
  const [view, setView] = useState<TopicView>("backlog");
  const [focus, setFocus] = useState("");
  const [planning, setPlanning] = useState(false);
  const [planRunId, setPlanRunId] = useState<string | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  const [changing, setChanging] = useState<string | null>(null);

  // A plan of the location from someone else (a teammate, the series planner, a draft planning first) shows too.
  const active = useActivePostRuns(locationId, { enabled: false });
  const otherPlan = active.runs.find((run) => run.kind === "plan" && run.run_id !== planRunId) ?? null;
  const inList = planRunId ? active.runs.some((run) => run.run_id === planRunId) : false;
  const mine = useAiRun(locationId, planRunId, { poll: !inList });
  const planRun = mine.run;
  const shownRun: PostAiRun | null = planRun && runIsActive(planRun) ? planRun : otherPlan;

  useOnRunEnd(locationId, [planRunId], (run) => {
    if (run.kind !== "plan" || run.status !== "done") return;
    const result = run.result;
    if (!result) return;
    setFresh(new Set(result.topics.map((topic) => topic.topic_id)));
    setView("backlog");
    if (result.planned > 0) toast.success(result.planned === 1 ? "1 new topic planned" : `${result.planned} new topics planned`, { description: "They're marked New in your list." });
    else if (result.backlog_full) toast.info("Your list is full", { description: "Dismiss a topic to make room for new ones." });
    else toast.info("No new topics this time", { description: "Add facts, offers or events in AI Settings to give the AI more to plan from." });
  });

  const blocked = Boolean(aiReason);
  const data = topics.data;
  const max = data?.limits?.backlog_max ?? BACKLOG_MAX;
  const working = planning || Boolean(shownRun);

  const plan = async () => {
    const text = focus.trim().slice(0, FOCUS_MAX);
    setPlanning(true);
    try {
      const answer = await planPostTopics(locationId, text ? { focus: text } : {});
      if (isRunStart(answer)) {
        noteRun(answer.run);
        setPlanRunId(answer.run.run_id);
        if (answer.existing) toast.info("Already planning", { description: "A plan with this focus is running. It shows here when it's done." });
      } else {
        queryClient.setQueryData(postTopicsKey(locationId), listOf(answer));
        toast.info("Your list is full", { description: `${max} topics are waiting. Dismiss some to make room, or plan with a focus.` });
      }
      setFocus("");
    } catch (error) {
      const held = runFromConflict(error);
      if (held) {
        noteRun(held);
        setPlanRunId(held.run_id);
        toast.info("Another plan is running", { description: "Wait for it to finish, then plan with your focus." });
      } else {
        toastError(error, "Topics couldn't be planned");
      }
    } finally {
      setPlanning(false);
    }
  };

  const changeStatus = (topic: PostTopic, next: "dismissed" | "proposed") => {
    setChanging(topic.topic_id);
    status.mutate(
      { topicId: topic.topic_id, status: next },
      {
        onSuccess: () => toast.success(next === "dismissed" ? "Topic dismissed" : "Topic restored"),
        onError: (error) => toast.error(topicErrorText(error, next === "dismissed" ? "The topic couldn't be dismissed." : "The topic couldn't be restored.")),
        onSettled: () => setChanging(null),
      },
    );
  };

  const counts = data
    ? { backlog: data.backlog.length, reserved: data.reserved.length, used: data.recently_used.length, dismissed: data.dismissed.length }
    : null;
  const shown = !data
    ? []
    : view === "backlog"
      ? data.backlog
      : view === "reserved"
        ? data.reserved
        : view === "used"
          ? data.recently_used
          : data.dismissed;

  return (
    <div className={cn("space-y-4", className)}>
      {heading ? (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-foreground">
              Post topics
              {counts ? (
                <span className="text-sm font-normal text-muted-foreground">
                  {counts.backlog} of {max} waiting
                </span>
              ) : null}
            </h3>
            <p className="text-sm text-muted-foreground">
              Planned for this business from its services, facts, the season and your keywords, best first. Topics never repeat. Planning is free.
            </p>
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Focus for new topics (optional)"
            placeholder="Focus (optional), e.g. holiday baking"
            maxLength={FOCUS_MAX}
            value={focus}
            disabled={working}
            onChange={(event) => setFocus(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !working && !blocked) void plan();
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0 text-ai hover:border-ai/40 hover:bg-ai-surface hover:text-ai"
            disabled={working || blocked}
            title={aiReason}
            onClick={() => void plan()}
          >
            {working ? <LoaderCircle aria-hidden className="animate-spin" /> : <Lightbulb aria-hidden />} Plan more topics
          </Button>
        </div>
      ) : null}
      {canEdit && blocked ? <p className="text-xs text-muted-foreground">{aiReason}</p> : null}

      {shownRun ? <RunProgress run={shownRun} /> : null}
      {planRun?.status === "failed" ? (
        <RunFailure run={planRun} fallback="Topics couldn't be planned" onRetry={canEdit && !blocked ? () => void plan() : undefined} onDismiss={() => setPlanRunId(null)} />
      ) : null}

      {canEdit && data?.suggestions.length ? (
        // "Add a current offer in AI facts…": for whoever can add one (a client user can't act on it).
        <ul className="space-y-2">
          {data.suggestions.map((suggestion) => (
            <li key={suggestion.code} className="flex flex-col gap-2 rounded-lg border border-info/25 bg-info-surface px-3 py-2.5 sm:flex-row sm:items-center">
              <p className="flex min-w-0 flex-1 items-start gap-2 text-sm text-foreground">
                <CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
                <span>{suggestion.message}</span>
              </p>
              <Button asChild size="sm" variant="outline" className="self-start sm:self-center">
                <Link to={locationPath(locationId, "ai/settings", "#facts")}>
                  {suggestionLinkText(suggestion)} <ArrowRight aria-hidden />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {topics.isPending ? (
        <ListSkeleton rows={2} />
      ) : topics.isError ? (
        <ErrorState compact description={postErrorText(topics.error, "Topics couldn't be loaded.").message} onRetry={() => void topics.refetch()} />
      ) : (
        <>
          <FilterChips
            aria-label="Show topics"
            value={view}
            onChange={setView}
            options={[
              { id: "backlog", label: "Waiting", count: counts?.backlog },
              { id: "reserved", label: "Being written", count: counts?.reserved },
              { id: "used", label: "Used recently", count: counts?.used },
              { id: "dismissed", label: "Dismissed", count: counts?.dismissed },
            ]}
          />
          {shown.length === 0 ? (
            <p className="rounded-lg bg-surface-strong px-3 py-2.5 text-sm text-muted-foreground">{EMPTY_TEXT[view](canEdit)}</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((topic) => (
                <TopicCard
                  key={topic.topic_id}
                  locationId={locationId}
                  topic={topic}
                  view={view}
                  fresh={fresh.has(topic.topic_id)}
                  canEdit={canEdit}
                  aiReason={aiReason}
                  draftCost={draftCost}
                  writing={writingTopicId === topic.topic_id}
                  busy={changing === topic.topic_id}
                  onWrite={onWrite}
                  onDismiss={() => changeStatus(topic, "dismissed")}
                  onRestore={() => changeStatus(topic, "proposed")}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

const EMPTY_TEXT: Record<TopicView, (canEdit: boolean) => string> = {
  backlog: (canEdit) => (canEdit ? "No topics are waiting. Plan some now: it's free." : "No topics are waiting yet. Your agency plans them."),
  reserved: () => "No topic is being written right now.",
  used: () => "No topic was used recently. Posts written from a topic show here.",
  dismissed: () => "No dismissed topics.",
};

function TopicCard({
  locationId,
  topic,
  view,
  fresh,
  canEdit,
  aiReason,
  draftCost,
  writing,
  busy,
  onWrite,
  onDismiss,
  onRestore,
}: {
  locationId: string;
  topic: PostTopic;
  view: TopicView;
  fresh: boolean;
  canEdit: boolean;
  aiReason: string | undefined;
  draftCost: number;
  writing: boolean;
  busy: boolean;
  onWrite: ((topic: PostTopic) => void) | undefined;
  onDismiss: () => void;
  onRestore: () => void;
}) {
  const reasons = topicReasonLabels(topic.reasons);
  const timing = topicTimingText(topic);
  const pillar = topic.pillar?.name;
  return (
    <li className={cn("flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-xs", fresh ? "border-ai/40 ring-1 ring-ai/20" : "border-border")}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 text-sm font-semibold leading-snug text-foreground">{topic.title}</h4>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {fresh ? (
            <StatusBadge tone="ai" icon={Sparkles} size="sm">
              New
            </StatusBadge>
          ) : null}
          {topic.type !== "standard" ? (
            <StatusBadge tone="info" size="sm">
              {POST_TYPE_LABEL[topic.type]}
            </StatusBadge>
          ) : null}
        </span>
      </div>
      {topic.question ? <p className="mt-1 text-sm text-muted-foreground">{topic.question}</p> : null}
      <p className="mt-2.5 flex flex-wrap items-center gap-1">
        {topic.angle_label ? (
          <Badge variant="ai" size="sm">
            {topic.angle_label}
          </Badge>
        ) : null}
        {pillar ? (
          <Badge variant="neutral" size="sm">
            {pillar}
          </Badge>
        ) : null}
        {topic.keyword ? (
          <Badge variant="neutral" size="sm">
            <Tag aria-hidden /> {topic.keyword}
          </Badge>
        ) : null}
      </p>
      {timing ? <p className="mt-2 text-xs font-medium text-foreground">{timing}</p> : null}
      {reasons.length ? <p className="mt-2 text-xs text-muted-foreground">Why: {reasons.join(" · ")}</p> : null}
      {view === "used" && topic.post_id ? (
        <Button asChild variant="link" size="sm" className="mt-1 h-auto self-start px-0 py-1 text-xs">
          <Link to={locationPath(locationId, "gbp/posts", `?post=${encodeURIComponent(topic.post_id)}`)}>
            See the post <ArrowRight aria-hidden />
          </Link>
        </Button>
      ) : null}
      {canEdit && (view === "backlog" || view === "dismissed") ? (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
          {view === "backlog" ? (
            <>
              {onWrite ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-ai hover:border-ai/40 hover:bg-ai-surface hover:text-ai"
                  disabled={Boolean(aiReason) || writing || busy}
                  title={aiReason}
                  onClick={() => onWrite(topic)}
                >
                  {writing ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />} Write this post
                  <AiCostChip tokens={draftCost} />
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="ghost" disabled={busy || writing} onClick={onDismiss}>
                {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <X aria-hidden />} Dismiss
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onRestore}>
              {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <RotateCcw aria-hidden />} Restore
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}
