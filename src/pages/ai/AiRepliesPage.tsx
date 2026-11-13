import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Inbox,
  Languages,
  MessageSquareReply,
  MessageSquareText,
  PenLine,
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
import { BulkReplies } from "@/components/reputation/bulk-replies";
import { ReplyAuthorizationBanner, ReplyAuthorizationStatus } from "@/components/reputation/reply-authorization";
import { ReviewInsightsCard } from "@/components/reputation/review-insights";
import { ReplyQueueKpis } from "@/components/reputation/review-kpis";
import { ReviewsGateState } from "@/components/reputation/review-gates";
import { RefreshReviewsButton, ReviewsSyncMeta } from "@/components/reputation/review-sync";
import { REVIEWS_PAGE_SIZE, ReviewsFeed } from "@/components/reputation/reviews-feed";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { useAiStatus } from "@/lib/ai/ai-status";
import { keywordsPath } from "@/lib/keywords/paths";
import { useLocationRoute } from "@/lib/locations/location-route-context";
import { locationPath } from "@/lib/mypageseo/section-links";
import { reviewErrorMessage } from "@/lib/reviews/review-errors";
import { REPLY_QUEUE_PRESETS, replyQueuePreset, useReplyQueueParams, useReviewSpotlight, type ReplyQueuePreset } from "@/lib/reviews/review-filters";
import { draftableCount, noReplyCount, reviewsGate } from "@/lib/reviews/review-metrics";
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

  const counts: Record<ReplyQueuePreset, number | undefined> = {
    // "No reply yet" is `reply_state=none`: unreplied minus drafts and (Phase 25a) replies Google rejected.
    none: noReplyCount(stats),
    drafts: stats.drafts_pending,
    rejected: rejectedFromSummary ?? rejected.data,
    low: low.data,
    attention: attention.data,
    failed: failed.data,
    suspicious: suspicious.data,
  };
  if (openList.data && !openList.isPlaceholderData) counts[preset] = openList.data.total;
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
          <ReviewsFeed
            locationId={locationId}
            ai={ai}
            query={queueQuery}
            page={page}
            onPageChange={setPage}
            caption="Newest first"
            unansweredOnly={preset !== "failed"}
            spotlight={spotlight}
            onSpotlightChange={setSpotlight}
            empty={<QueueEmpty preset={preset} drafts={stats.drafts_pending} canEdit={canEdit} onShowDrafts={() => setPreset("drafts")} />}
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
function QueueEmpty({ preset, drafts, canEdit, onShowDrafts }: { preset: ReplyQueuePreset; drafts: number; canEdit: boolean; onShowDrafts: () => void }) {
  switch (preset) {
    case "none":
      return (
        <EmptyState
          variant="all-done"
          title="No reviews waiting"
          description={
            drafts > 0
              ? canEdit
                ? "Every review has a reply or a draft. Check the drafts, then send them."
                : "Every review has a reply, or your agency is preparing one."
              : "Every review has a reply. New reviews show up here after the next check with Google."
          }
          action={
            drafts > 0 ? (
              <Button size="sm" variant="outline" onClick={onShowDrafts}>
                {canEdit ? `Check ${drafts} ${drafts === 1 ? "draft" : "drafts"}` : `Show ${drafts} ${drafts === 1 ? "review" : "reviews"}`}
              </Button>
            ) : undefined
          }
        />
      );
    case "drafts":
      return (
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

/** The reply rules, as the backend applies them (replies v2, Phase 25a). */
function replyRules(keywords: ReactNode, settings: ReactNode): { key: string; icon: LucideIcon; text: ReactNode }[] {
  return [
    { key: "length", icon: Check, text: "Short: 20–60 words for a 5-star review, up to 100 for 1–2 stars, a sentence or two when there's no text." },
    { key: "language", icon: Languages, text: "Written in the reviewer's own language." },
    { key: "keywords", icon: Tags, text: <>At most one of your {keywords}, only when the review is about it (never for 1–2 stars).</> },
    {
      key: "low",
      icon: MessageSquareText,
      text: "For 1–2 stars: apologises without admitting fault, gives your contact line, offers nothing and never argues.",
    },
    { key: "name", icon: UserRound, text: "Uses the reviewer's first name only, and no names at all in restricted mode (health, legal and financial businesses)." },
    { key: "rules", icon: SlidersHorizontal, text: <>Follows the house rules, signature and contact line in your {settings}.</> },
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
