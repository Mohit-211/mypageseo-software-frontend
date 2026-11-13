import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Inbox, Languages, MessageSquareReply, MessageSquareText, PenLine, ShieldCheck, Tags, UserRound, type LucideIcon } from "lucide-react";
import { AiStatusBanner } from "@/components/ai/ai-status-banner";
import { AiStatusPill } from "@/components/ai/ai-status-pill";
import { PageHeader, SectionHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { FilterChips } from "@/components/layout/shared/filter-chips";
import { BulkReplies } from "@/components/reputation/bulk-replies";
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
import { REPLY_QUEUE_PRESETS, replyQueuePreset, useReplyQueueParams, type ReplyQueuePreset } from "@/lib/reviews/review-filters";
import { draftableCount, noReplyCount, reviewsGate } from "@/lib/reviews/review-metrics";
import { useReviewCount, useReviewsList, useReviewsSummary } from "@/lib/reviews/use-reviews";

/** Views that only show up when they have reviews in them (or are open). */
const SHOWN_WHEN_NOT_EMPTY: ReadonlySet<ReplyQueuePreset> = new Set(["low", "failed", "suspicious"]);

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
  const queueRef = useRef<HTMLElement>(null);

  const data = summary.data;
  const gate = data ? reviewsGate(data) : null;
  const stats = data?.stats ?? null;
  const ready = Boolean(data && !gate && stats && stats.total > 0);

  // Counts the summary can't give, so every queue view shows a real number.
  const failed = useReviewCount(locationId, replyQueuePreset("failed").query, ready);
  const low = useReviewCount(locationId, replyQueuePreset("low").query, ready);
  const attention = useReviewCount(locationId, replyQueuePreset("attention").query, ready);
  const suspicious = useReviewCount(locationId, replyQueuePreset("suspicious").query, ready);
  // The open view's own list (the same request the queue makes, shared through the cache): its total
  // is what the queue shows, so the open chip always matches it.
  const current = replyQueuePreset(preset);
  const queueQuery = { ...current.query, sort: "newest" as const };
  const openList = useReviewsList(locationId, { ...queueQuery, page, limit: REVIEWS_PAGE_SIZE }, ready);

  const show = (next: ReplyQueuePreset) => {
    setPreset(next);
    queueRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const header = (
    <PageHeader
      icon={MessageSquareReply}
      tone="ai"
      title="AI Review Replies"
      description={
        canEdit
          ? "AI drafts a reply for every review that needs one, in the reviewer's language. You check it, edit it and send it."
          : "Every review waiting for a reply, and the replies your agency drafts with AI before sending them to Google."
      }
      meta={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <AiStatusPill status={ai} />
          {data && !gate ? <ReviewsSyncMeta summary={data} /> : null}
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
    none: noReplyCount(stats),
    drafts: stats.drafts_pending,
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
      <AiStatusBanner status={ai} />
      <ReplyQueueKpis
        stats={stats}
        draftable={draftableCount(summary.data)}
        {...(preset === "none" && counts.none !== undefined ? { waiting: counts.none } : {})}
        canEdit={canEdit}
        onShowWaiting={() => show("none")}
        onShowDrafts={() => show("drafts")}
      />
      {/* Keyed: a "Continue (N left)", send failures or an open dialog belong to one location. */}
      <BulkReplies key={locationId} locationId={locationId} summary={summary.data} ai={ai} variant="hero" onShowDrafts={() => show("drafts")} />

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
                failed sends and suspicious reviews keep a red count while unselected. */}
            <FilterChips
              aria-label="Queue views"
              value={preset}
              options={views.map((view) => ({
                id: view.id,
                label: view.label,
                count: counts[view.id],
                ...(view.id === "failed" || view.id === "suspicious" ? { attention: "critical" as const } : {}),
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
                : "Every review has a reply or a draft waiting to be sent."
              : "Every review has a reply. New reviews show up here after the next check with Google."
          }
          action={
            drafts > 0 ? (
              <Button size="sm" variant="outline" onClick={onShowDrafts}>
                {canEdit ? "Check" : "See"} {drafts} {drafts === 1 ? "draft" : "drafts"}
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
              : "Replies your agency drafts show up here before they're sent to Google."
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

/** The reply rules, as the backend's prompt applies them. Replies use the first 8 tracked keywords. */
function replyRules(keywords: ReactNode): { key: string; icon: LucideIcon; text: ReactNode }[] {
  return [
    { key: "length", icon: Check, text: "Two to four sentences, a little longer for 1–3 star reviews." },
    { key: "language", icon: Languages, text: "Written in the reviewer's own language." },
    { key: "keywords", icon: Tags, text: <>Your first 8 {keywords}, only where they read naturally (rarely in replies to 1–2 star reviews).</> },
    {
      key: "low",
      icon: MessageSquareText,
      text: "For 1–3 stars: acknowledges and apologises without admitting fault, invites them to get in touch, and never argues.",
    },
    { key: "name", icon: UserRound, text: "Uses the reviewer's first name only." },
    { key: "suspicious", icon: ShieldCheck, text: "No AI reply to reviews with suspicious indicators: ask Google to remove those instead." },
  ];
}

function HowRepliesAreWritten({ locationId, canEdit }: { locationId: string; canEdit: boolean }) {
  const keywordsLink = (
    <Link
      to={keywordsPath(locationId)}
      className="rounded-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      keywords
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
        {replyRules(keywordsLink).map(({ key, icon: Icon, text }) => (
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
