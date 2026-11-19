import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  Inbox,
  Languages,
  MessageSquareReply,
  MessageSquareText,
  PenLine,
  Repeat2,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { AiStatusBanner } from "@/components/ai/ai-status-banner";
import { AiStatusPill } from "@/components/ai/ai-status-pill";
import { PageHeader, SectionHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { FilterChips } from "@/components/layout/shared/filter-chips";
import { AutoReplySummaryLine } from "@/components/reputation/auto-reply-status";
import { BulkReplies } from "@/components/reputation/bulk-replies";
import { ReplyAuthorizationBanner, ReplyAuthorizationStatus } from "@/components/reputation/reply-authorization";
import { ReviewInsightsCard } from "@/components/reputation/review-insights";
import { ReplyQueueKpis } from "@/components/reputation/review-kpis";
import { ReviewsGateState } from "@/components/reputation/review-gates";
import { RefreshReviewsButton, ReviewsSyncMeta } from "@/components/reputation/review-sync";
import { REVIEWS_PAGE_SIZE, ReviewsFeed } from "@/components/reputation/reviews-feed";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { useAiStatus, type AiStatus } from "@/lib/ai/ai-status";
import { keywordsPath } from "@/lib/keywords/paths";
import { useLocationRoute } from "@/lib/locations/location-route-context";
import { locationPath } from "@/lib/mypageseo/section-links";
import { reviewErrorMessage } from "@/lib/reviews/review-errors";
import {
  REPLY_QUEUE_PRESETS,
  REPLY_UPDATES_QUERY,
  replyQueuePreset,
  useReplyQueueParams,
  useReviewSpotlight,
  type ReplyQueuePreset,
} from "@/lib/reviews/review-filters";
import { draftableCount, draftsToCheckCount, noReplyCount, reviewsGate } from "@/lib/reviews/review-metrics";
import { focusReviewCard } from "@/lib/reviews/review-spotlight";
import { useReviewCount, useReviewsList, useReviewsSummary } from "@/lib/reviews/use-reviews";

/** Views that only show up when they have reviews in them (or are open). */
const SHOWN_WHEN_NOT_EMPTY: ReadonlySet<ReplyQueuePreset> = new Set(["rejected", "low", "failed", "suspicious"]);

/** Views whose count turns red while unselected: something went wrong with a reply, or a review may break Google's rules. */
const CRITICAL_VIEWS: ReadonlySet<ReplyQueuePreset> = new Set(["rejected", "failed", "suspicious"]);

/**
 * AI Review Replies (`/locations/:locationId/ai/replies`): a focused reply queue. AI drafts a reply
 * for every review that needs one, you check and edit it, you send it. The numbers, "Draft all",
 * the queue (newest first, preset views kept in `?filter=`) and what customers say, on one page.
 * Manual replies keep working when AI is off.
 *
 * 2026-11-17: "Drafts to check" also lists the drafts that replace a reply on Google (`reply_update=true`,
 * above the other drafts: the API lists them apart), and the header says how automatic replies are doing
 * when the server's switch for them is on. The AI digest email links here with `?filter=drafts`.
 */
function AiRepliesPage() {
  const { location } = useLocationRoute();
  const locationId = location.location_id;
  const summary = useReviewsSummary(locationId);
  const ai = useAiStatus(locationId);
  const canEdit = useCanEdit();
  const { preset, page, setPreset, setPage } = useReplyQueueParams();
  const [spotlight, setSpotlight] = useReviewSpotlight();
  const queueRef = useRef<HTMLElement>(null);

  const data = summary.data;
  const gate = data ? reviewsGate(data) : null;
  const stats = data?.stats ?? null;
  const ready = Boolean(data && !gate && stats && stats.total > 0);
  // Phase 25a servers count rejected replies in the summary; older ones don't have the view.
  const rejectedFromSummary = stats?.replies_rejected;

  // Counts the summary can't give, so every queue view shows a real number.
  const failed = useReviewCount(locationId, replyQueuePreset("failed").query, ready);
  const low = useReviewCount(locationId, replyQueuePreset("low").query, ready);
  const attention = useReviewCount(locationId, replyQueuePreset("attention").query, ready);
  const suspicious = useReviewCount(locationId, replyQueuePreset("suspicious").query, ready);
  const rejected = useReviewCount(locationId, replyQueuePreset("rejected").query, ready && rejectedFromSummary === undefined && preset === "rejected");
  // The open view's own list (the same request the queue makes, shared through the cache): its total
  // is what the queue shows, so the open chip always matches it.
  const current = replyQueuePreset(preset);
  const queueQuery = { ...current.query, sort: "newest" as const };
  const openList = useReviewsList(locationId, { ...queueQuery, page, limit: REVIEWS_PAGE_SIZE }, ready);

  const show = (next: ReplyQueuePreset) => {
    setPreset(next);
    queueRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  /** "Open it" on a review a send held back: its card when it's on the page, else pinned above the queue. */
  const openReview = (reviewId: string) => {
    if (!focusReviewCard(reviewId)) setSpotlight(reviewId);
  };

  const authorizationNames = { locationId, locationName: location.name, clientName: location.client?.name ?? null };

  const header = (
    <PageHeader
      icon={MessageSquareReply}
      tone="ai"
      title="AI Review Replies"
      description={
        canEdit
          ? "AI drafts a reply for every review that needs one, in the reviewer's language. You check it, edit it and send it."
          : // A client user never sees draft text, so this promises only what they'll see: the replies sent.
            "Every review waiting for a reply. Your agency prepares the replies and sends them to Google; you'll see each reply on its review once it's sent."
      }
      meta={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <AiStatusPill status={ai} />
          {data && !gate ? <ReviewsSyncMeta summary={data} /> : null}
          {data && !gate ? <ReplyAuthorizationStatus {...authorizationNames} /> : null}
          {/* Phase 25b: "Automatic replies: on · 3 sent this week · 1 held for a person", only while the switch is on. */}
          {data && !gate ? <AutoReplySummaryLine locationId={locationId} summary={data} /> : null}
        </div>
      }
      actions={
        data && !gate ? (
          <>
            <RefreshReviewsButton locationId={locationId} summary={data} />
            <Button asChild variant="outline">
              <Link to={locationPath(locationId, "reputation")}>
                <MessageSquareText aria-hidden /> All reviews
              </Link>
            </Button>
          </>
        ) : undefined
      }
    />
  );

  if (summary.isPending) {
    return (
      <>
        {header}
        <PageSkeleton header={false} metrics={4} rows={4} />
      </>
    );
  }
  if (summary.isError) {
    return (
      <>
        {header}
        <ErrorState
          title="Reviews couldn't be loaded"
          description={reviewErrorMessage(summary.error, "Something went wrong while loading the reviews.").message}
          onRetry={() => void summary.refetch()}
        />
      </>
    );
  }
  if (gate) {
    return (
      <>
        {header}
        <ReviewsGateState gate={gate} />
      </>
    );
  }
  if (!stats || stats.total === 0) {
    return (
      <>
        {header}
        <ReplyAuthorizationBanner {...authorizationNames} />
        <AiStatusBanner status={ai} />
        <EmptyState
          icon={MessageSquareReply}
          tone="ai"
          title="No reviews to answer yet"
          description="When customers review this business on Google, they show up here and AI can draft a reply to each one for you to check and send."
          action={<RefreshReviewsButton locationId={locationId} summary={summary.data} />}
        />
      </>
    );
  }

  // 2026-11-17 (G3): drafts that replace a reply on Google are "Drafts to check" too, listed above the others.
  const updates = stats.reply_updates_pending ?? 0;
  const counts: Record<ReplyQueuePreset, number | undefined> = {
    // "No reply yet" is `reply_state=none`: unreplied minus drafts and (Phase 25a) replies Google rejected.
    none: noReplyCount(stats),
    drafts: draftsToCheckCount(stats),
    rejected: rejectedFromSummary ?? rejected.data,
    low: low.data,
    attention: attention.data,
    failed: failed.data,
    suspicious: suspicious.data,
  };
  if (openList.data && !openList.isPlaceholderData) counts[preset] = openList.data.total + (preset === "drafts" ? updates : 0);
  // Low-rated and the problem views only show up when they have something in them (or are open).
  const views = REPLY_QUEUE_PRESETS.filter((view) => !SHOWN_WHEN_NOT_EMPTY.has(view.id) || view.id === preset || (counts[view.id] ?? 0) > 0);

  return (
    <>
      {header}
      <ReplyAuthorizationBanner {...authorizationNames} />
      <AiStatusBanner status={ai} />
      <ReplyQueueKpis
        stats={stats}
        draftable={draftableCount(summary.data)}
        {...(preset === "none" && counts.none !== undefined ? { waiting: counts.none } : {})}
        canEdit={canEdit}
        onShowWaiting={() => show("none")}
        onShowDrafts={() => show("drafts")}
      />
      {/* Keyed: a "Continue (N left)", send results or an open dialog belong to one location. */}
      <BulkReplies
        key={locationId}
        locationId={locationId}
        summary={summary.data}
        ai={ai}
        variant="hero"
        onShowDrafts={() => show("drafts")}
        onShowUpdates={() => show("drafts")}
        onOpenReview={openReview}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section ref={queueRef} aria-label="Reply queue" className="min-w-0 scroll-mt-20 space-y-4">
          <div>
            <SectionHeader
              title="Reply queue"
              description={canEdit ? current.hint : (current.clientHint ?? current.hint)}
              icon={Inbox}
              tone="ai"
              className="mb-3"
            />
            {/* The shared chips: selection is solid teal on every list page (violet stays for AI itself);
                rejected replies, failed sends and suspicious reviews keep a red count while unselected. */}
            <FilterChips
              aria-label="Queue views"
              value={preset}
              options={views.map((view) => ({
                id: view.id,
                label: canEdit ? view.label : (view.clientLabel ?? view.label),
                count: counts[view.id],
                ...(CRITICAL_VIEWS.has(view.id) ? { attention: "critical" as const } : {}),
              }))}
              onChange={setPreset}
            />
          </div>
          {preset === "drafts" && updates > 0 ? (
            // Keyed: its page and kept cards belong to one location.
            <ReplyUpdates key={locationId} locationId={locationId} ai={ai} count={updates} canEdit={canEdit} />
          ) : null}
          <ReviewsFeed
            locationId={locationId}
            ai={ai}
            query={queueQuery}
            page={page}
            onPageChange={setPage}
            caption={preset === "drafts" && updates > 0 ? "Other drafts, newest first" : "Newest first"}
            unansweredOnly={preset !== "failed"}
            spotlight={spotlight}
            onSpotlightChange={setSpotlight}
            empty={
              <QueueEmpty
                preset={preset}
                drafts={stats.drafts_pending}
                updates={updates}
                canEdit={canEdit}
                onShowDrafts={() => setPreset("drafts")}
              />
            }
          />
        </section>

        <aside aria-label="About your replies" className="min-w-0 space-y-4 xl:sticky xl:top-20 xl:self-start">
          <ReviewInsightsCard locationId={locationId} ai={ai} summary={summary.data} />
          <HowRepliesAreWritten locationId={locationId} canEdit={canEdit} />
        </aside>
      </div>
    </>
  );
}

/** What an empty view says. A client user gets no instructions for buttons only their agency has. */
function QueueEmpty({
  preset,
  drafts,
  updates,
  canEdit,
  onShowDrafts,
}: {
  preset: ReplyQueuePreset;
  drafts: number;
  /** Drafts that replace a reply on Google (2026-11-17), listed above the other drafts. */
  updates: number;
  canEdit: boolean;
  onShowDrafts: () => void;
}) {
  const toCheck = drafts + updates;
  switch (preset) {
    case "none":
      return (
        <EmptyState
          variant="all-done"
          title="No reviews waiting"
          description={
            toCheck > 0
              ? canEdit
                ? "Every review has a reply or a draft. Check the drafts, then send them."
                : "Every review has a reply, or your agency is preparing one."
              : "Every review has a reply. New reviews show up here after the next check with Google."
          }
          action={
            toCheck > 0 ? (
              <Button size="sm" variant="outline" onClick={onShowDrafts}>
                {canEdit ? `Check ${toCheck} ${toCheck === 1 ? "draft" : "drafts"}` : `Show ${toCheck} ${toCheck === 1 ? "review" : "reviews"}`}
              </Button>
            ) : undefined
          }
        />
      );
    case "drafts":
      return updates > 0 ? (
        <EmptyState
          icon={PenLine}
          tone="ai"
          title="No other drafts to check"
          description={canEdit ? "Only the updates above are waiting. Send each one from its review." : "Only the updates above are being prepared."}
        />
      ) : (
        <EmptyState
          icon={PenLine}
          tone="ai"
          title="No drafts to check"
          description={
            canEdit
              ? "Drafts appear here when AI drafts replies for you, or when you save a reply without sending it."
              : "When your agency prepares a reply to a review, the review shows up here until the reply is sent to Google."
          }
        />
      );
    case "rejected":
      return (
        <EmptyState
          variant="all-done"
          title="No rejected replies"
          description={
            canEdit
              ? "Google published every reply you sent, or a new draft is waiting for the ones it rejected."
              : "Google published every reply sent, or a new one is on its way."
          }
        />
      );
    case "low":
      return <EmptyState variant="all-done" title="No low-rated reviews waiting" description="Every review at 1–3 stars has a reply on Google." />;
    case "attention":
      return <EmptyState variant="all-done" title="Nothing needs attention" description="No unanswered review was marked for a closer look." />;
    case "failed":
      return <EmptyState variant="all-done" title="Nothing failed" description={canEdit ? "Every reply you sent reached Google." : "Every reply sent reached Google."} />;
    default:
      return <EmptyState variant="all-done" icon={ShieldCheck} title="No suspicious reviews" description="None of your unanswered reviews show signs of breaking Google's rules." />;
  }
}

/**
 * The drafts that replace a reply already on Google (2026-11-17, G3: `reply_update=true`), at the top of "Drafts
 * to check". The API can't list them with the other drafts, so they have their own short list (and page). They go
 * one at a time, so there is no selection: each card sends its own.
 */
function ReplyUpdates({ locationId, ai, count, canEdit }: { locationId: string; ai: AiStatus; count: number; canEdit: boolean }) {
  const [page, setPage] = useState(1);
  return (
    <section aria-labelledby="reply-updates-title" className="space-y-2 rounded-xl border border-info/25 bg-info-surface/40 p-2 sm:p-3">
      <div className="flex items-start gap-2 px-1">
        <Repeat2 aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
        <div className="min-w-0">
          <h3 id="reply-updates-title" className="text-sm font-semibold text-foreground">
            {count === 1 ? "1 draft replaces a reply on Google" : `${count.toLocaleString()} drafts replace a reply on Google`}
          </h3>
          <p className="text-xs text-muted-foreground">
            {canEdit
              ? "Sending one replaces the reply people see on Google now. They go one at a time: send each one from its review."
              : "Your agency is preparing a new version of these replies."}
          </p>
        </div>
      </div>
      <ReviewsFeed
        locationId={locationId}
        ai={ai}
        query={{ ...REPLY_UPDATES_QUERY, sort: "newest" }}
        page={page}
        onPageChange={setPage}
        caption="Updates"
        bulk={false}
        empty={<p className="px-1 pb-1 text-sm text-muted-foreground">These updates were sent or removed meanwhile.</p>}
      />
    </section>
  );
}

/** The reply rules, as the backend applies them (replies v3, Phase 25b). */
function replyRules(keywords: ReactNode, settings: ReactNode): { key: string; icon: LucideIcon; text: ReactNode }[] {
  return [
    {
      key: "specific",
      icon: Check,
      text: "Answers what the reviewer said: the service they used, the staff they named, their question. It never just repeats the review.",
    },
    {
      key: "versions",
      icon: ArrowLeftRight,
      text: "Writes two versions, scores them and shows you the better one. \"Try the other version\" switches, for free.",
    },
    { key: "length", icon: MessageSquareText, text: "Follows the review's length, never under 120 characters. Stars-only reviews get two real sentences, never just \"Thanks!\"." },
    { key: "language", icon: Languages, text: "Written in the reviewer's own language." },
    { key: "keywords", icon: Tags, text: <>At most one of your {keywords}, only when the review is about it (never for 1–2 stars).</> },
    {
      key: "low",
      icon: MessageSquareText,
      text: "For 1–2 stars: apologises without admitting fault, gives your contact line, offers nothing and never argues.",
    },
    { key: "name", icon: UserRound, text: "Uses the reviewer's first name only, and no names at all in restricted mode (health, legal and financial businesses)." },
    { key: "rules", icon: SlidersHorizontal, text: <>Follows the house rules, signature, contact line and facts in your {settings}, and learns your style from the replies you edit.</> },
    { key: "checks", icon: ScanSearch, text: "Every draft is checked for made-up facts, promises and personal details, then double-checked before you see it." },
    { key: "suspicious", icon: ShieldCheck, text: "No AI reply to reviews with suspicious indicators: ask Google to remove those instead." },
  ];
}

const INLINE_LINK = "rounded-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring";

function HowRepliesAreWritten({ locationId, canEdit }: { locationId: string; canEdit: boolean }) {
  const keywordsLink = (
    <Link to={keywordsPath(locationId)} className={INLINE_LINK}>
      keywords
    </Link>
  );
  const settingsLink = (
    <Link to={locationPath(locationId, "ai/settings", "#replies")} className={INLINE_LINK}>
      AI Settings
    </Link>
  );
  return (
    <section aria-labelledby="how-replies-title" className="rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-4 py-3.5">
        <h2 id="how-replies-title" className="text-[15px] font-semibold leading-6 text-foreground">
          How AI writes your replies
        </h2>
      </div>
      <ul className="space-y-3 p-4">
        {replyRules(keywordsLink, settingsLink).map(({ key, icon: Icon, text }) => (
          <li key={key} className="flex gap-2.5 text-sm text-foreground">
            <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-ai" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-border px-4 py-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={keywordsPath(locationId)}>
            {canEdit ? "Manage your keywords" : "See your keywords"} <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}

export default AiRepliesPage;
