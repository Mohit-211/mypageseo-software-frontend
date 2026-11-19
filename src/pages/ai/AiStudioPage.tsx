import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  Coins,
  Lightbulb,
  Lock,
  MessageSquareReply,
  MousePointerClick,
  PenLine,
  Radar,
  RotateCcw,
  Sparkles,
  Tags,
  type LucideIcon,
} from "lucide-react";
import type { ReplyCredits } from "@/api";
import { AiCostTable } from "@/components/ai/ai-cost-table";
import { AiFeatureCard } from "@/components/ai/ai-feature-card";
import { AiNextActions } from "@/components/ai/ai-next-actions";
import { AiStatusBanner } from "@/components/ai/ai-status-banner";
import { AiStatusPill } from "@/components/ai/ai-status-pill";
import { ReadinessChecklist } from "@/components/ai-readiness/readiness-checklist";
import { AiSettingsLinks } from "@/components/ai-settings/ai-settings-links";
import { PageHeader, SectionHeader } from "@/components/layout/shared/data-display";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { BuyTokensDialog } from "@/components/layout/shared/token-balance";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccess, useCanEdit } from "@/hooks/use-access";
import { formatTokenCount, type AiCosts } from "@/lib/ai/ai-costs";
import { buildAiNextActions } from "@/lib/ai/ai-next-actions";
import { useAiStatus } from "@/lib/ai/ai-status";
import { formatShortDate } from "@/lib/datetime";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { useLocationRoute } from "@/lib/locations/location-route-context";
import { locationPath } from "@/lib/mypageseo/section-links";
import { PLANNER_PAUSED_TITLE, autoPostsState } from "@/lib/posts/series-planner";
import { usePostSeries, usePostsSummary } from "@/lib/posts/use-posts";
import { MAX_KEYWORDS } from "@/lib/rankings/keywords";
import { useTracking } from "@/lib/rankings/use-rankings";
import { useAutoReplyFeature } from "@/lib/reviews/auto-reply";
import { DEFAULT_BLOCK_SIZE, creditCost, creditsText } from "@/lib/reviews/reply-credits";
import { draftableCount, noReplyCount } from "@/lib/reviews/review-metrics";
import { isNoInsights, useReviewInsights, useReviewsSummary } from "@/lib/reviews/use-reviews";

/**
 * AI Studio (`/locations/:locationId/ai`): where to start with AI for this location. Whether AI is
 * on, "Get the AI ready · N of M done" (what the AI still lacks to write specifically), what to do next
 * (from real data only), every AI tool with its price, what the AI goes by (AI Settings, facts, the
 * business brief, the photo library), what AI costs and how it works. Everything here reads free GET
 * calls; nothing runs AI until a button on a tool page is pressed.
 */
function AiStudioPage() {
  const { location } = useLocationRoute();
  const id = location.location_id;
  const ai = useAiStatus(id);
  const canEdit = useCanEdit();
  const canBuy = useAccess().can("billing.manage");
  const { connect } = useGbpConnect();
  const [buying, setBuying] = useState(false);

  const reviews = useReviewsSummary(id);
  const posts = usePostsSummary(id);
  const series = usePostSeries(id);
  const tracking = useTracking(id);
  const summary = reviews.data;
  const stats = summary?.stats ?? null;
  const reviewsReady = Boolean(summary?.gbp_connected && summary.v4_enabled);
  // Insights exist only for reviews we can read; asking for a location without Google would only 404.
  const insights = useReviewInsights(id, reviewsReady);
  const draftable = summary ? draftableCount(summary) : 0;
  const draftsPending = stats?.drafts_pending ?? 0;
  const keywordCount = tracking.data ? tracking.data.tracking.keywords.length : null;
  const insightsState = insights.data ? "present" : insights.isError && isNoInsights(insights.error) ? "none" : null;
  const postsConnected = posts.data?.connection.gbp_connected ?? location.gbp_connected;

  const nextActions = buildAiNextActions({
    locationId: id,
    canRun: ai.canRun,
    // Paused AI says when it's back; a read-only or suspended account gets one row about the account.
    blockedBy: ai.blockedBy,
    resumesAt: ai.resumesAt,
    canPay: canBuy,
    reviews: summary
      ? {
          gbpConnected: summary.gbp_connected,
          v4Enabled: summary.v4_enabled,
          total: stats?.total ?? 0,
          waiting: stats ? noReplyCount(stats) : 0,
          draftable,
          ...(summary.ai?.draft_all_cost !== undefined ? { draftAllCost: summary.ai.draft_all_cost } : {}),
          draftsPending,
        }
      : null,
    posts: posts.data
      ? {
          gbpConnected: posts.data.connection.gbp_connected,
          publishedLast30Days: posts.data.stats.published_last_30_days,
          seriesProblems: posts.data.stats.series_problems ?? 0,
        }
      : null,
    keywordCount,
    insights: insightsState,
    costs: ai.costs,
  });
  const actionsLoading = reviews.isPending || posts.isPending || tracking.isPending;
  // "Draft replies" is priced as the Replies page's "Draft all" for these reviews: the replies left first ("7 left"),
  // then the blocks it buys ("1 token", "Free" only when the plan makes replies free).
  const draftRepliesCost = summary?.ai
    ? creditCost(draftable, summary.ai.credits ?? null, summary.ai.token_costs?.reply_drafts_per_10 ?? ai.costs.reply_drafts_per_10)
    : undefined;

  // The next auto-post: the soonest slot the planner really writes. While automatic AI posts are
  // paused (the series' `planner` isn't "on"), no slot is a next post: the stat says they're paused.
  const { active: activeSeries, pausedBy, nextSlot } = autoPostsState(series.data?.series ?? []);
  // The automatic paths exist only where their switch is on (both stay off until the grading round): "How AI works
  // here" mentions them only then.
  const autoRepliesFeature = useAutoReplyFeature(id);
  const autoPublishOn = (series.data?.series ?? []).some((item) => item.auto_publish?.switch === "on");
  const seriesCount = `${activeSeries.length} of ${series.data?.limit ?? 3} series`;

  const postsStat = !postsConnected
    ? "Ideas and drafts work now; publishing needs Google connected"
    : activeSeries.length
      ? pausedBy
        ? `${PLANNER_PAUSED_TITLE} · ${seriesCount}`
        : `Auto-posts on${nextSlot ? `: next one ${formatShortDate(nextSlot)}` : ""} · ${seriesCount}`
      : posts.data
        ? posts.data.stats.published_last_30_days > 0
          ? `${posts.data.stats.published_last_30_days} ${posts.data.stats.published_last_30_days === 1 ? "post" : "posts"} published in the last 30 days`
          : "No post in the last 30 days"
        : undefined;
  const repliesStat = !summary
    ? undefined
    : !summary.gbp_connected
      ? "Connect Google to answer your reviews"
      : !summary.v4_enabled
        ? "Waiting for Google to approve access"
        : draftable === 0 && draftsPending === 0
          ? "Every review has a reply"
          : `${draftable.toLocaleString()} to draft · ${draftsPending.toLocaleString()} ${draftsPending === 1 ? "draft" : "drafts"} to send`;
  const insightsStat =
    summary && !reviewsReady
      ? "Reads your Google reviews once Google is connected"
      : insights.data
        ? `Updated ${formatShortDate(insights.data.generated_at)}`
        : insightsState === "none"
          ? "Not generated yet"
          : undefined;
  const keywordsStat = keywordCount !== null ? `${keywordCount} of ${MAX_KEYWORDS} keywords tracked` : undefined;
  const cardStatus = ai.state;
  const balance = ai.balance === undefined ? {} : { balance: ai.balance };

  return (
    <>
      <PageHeader
        icon={Sparkles}
        tone="ai"
        title="AI Studio"
        description="AI that writes your Google posts and review replies in your business's voice. Nothing goes live until you say so."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <AiStatusPill status={ai} />
            {canEdit && ai.balance !== undefined ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium tabular-nums text-foreground">
                <Coins aria-hidden className="size-3.5 text-warning-foreground" />
                {formatTokenCount(ai.balance)}
              </span>
            ) : null}
          </div>
        }
        actions={
          // A read-only client user opens the tools from the cards below; these are for people who write.
          canEdit ? (
            <>
              {/* Straight to the Ideas section (only editors see it, as only they see this button). */}
              <Button asChild variant="outline">
                <Link to={locationPath(id, "ai/posts", ai.canRun ? "#ideas" : "")}>
                  <PenLine aria-hidden /> {ai.canRun ? "Get post ideas" : "Write a post"}
                </Link>
              </Button>
              <Button asChild variant="ai">
                <Link to={locationPath(id, "ai/replies")}>
                  <MessageSquareReply aria-hidden /> Reply to reviews
                </Link>
              </Button>
            </>
          ) : undefined
        }
      />

      <AiStatusBanner status={ai} />

      <ReadinessChecklist locationId={id} locationName={location.name} canEdit={canEdit} />

      {canEdit ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
          <AiNextActions items={nextActions} loading={actionsLoading} onConnect={() => connect()} replyCost={draftRepliesCost} {...balance} />
          <TokensCard balance={ai.balance} costs={ai.costs} credits={summary?.ai?.credits ?? null} canBuy={canBuy} onBuy={() => setBuying(true)} />
        </div>
      ) : null}

      <section aria-label="Your AI tools" className="space-y-4">
        <SectionHeader
          title="Your AI tools"
          description={canEdit ? `Everything AI can do for ${location.name}, with what each one costs.` : `Everything AI can do for ${location.name}.`}
        />
        {/* Prices only for people who spend tokens: a client user can't run AI (their agency does). */}
        <div className="grid gap-4 md:grid-cols-2">
          <AiFeatureCard
            icon={PenLine}
            title="AI Posts"
            description="Post ideas, Google posts written for you with an image if you like, and auto-posts that keep your profile active."
            to={locationPath(id, "ai/posts")}
            cta="Open AI Posts"
            cost={canEdit ? "post_draft" : undefined}
            status={cardStatus}
            locationId={id}
            {...balance}
            {...(postsStat ? { stat: postsStat } : {})}
          />
          <AiFeatureCard
            icon={MessageSquareReply}
            title="AI Review Replies"
            description={
              canEdit
                ? "A reply drafted for every review that needs one, in the reviewer's language. You check each one and send it."
                : "A reply drafted for every review that needs one, in the reviewer's language. Your agency checks each one and sends it."
            }
            to={locationPath(id, "ai/replies")}
            cta={canEdit ? "Reply to reviews" : "Open AI Review Replies"}
            // A block price: the chip reads "1 token = 10 replies", as the cost table below.
            cost={canEdit ? "reply_drafts_per_10" : undefined}
            status={cardStatus}
            locationId={id}
            {...balance}
            {...(repliesStat ? { stat: repliesStat } : {})}
          >
            {summary && !summary.gbp_connected && canEdit ? (
              <Button size="sm" variant="outline" onClick={() => connect()}>
                Connect Google
              </Button>
            ) : null}
          </AiFeatureCard>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AiFeatureCard
            icon={Lightbulb}
            title="Review insights"
            description="The themes customers mention most, what they praise and what they complain about."
            to={locationPath(id, "reputation/insights")}
            cta="See insights"
            cost={canEdit ? "insights" : undefined}
            status={reviewsReady || !summary ? cardStatus : undefined}
            locationId={id}
            {...balance}
            {...(insightsStat ? { stat: insightsStat } : {})}
          />
          <AiFeatureCard
            icon={Tags}
            title="Keyword ideas"
            description="Free keyword ideas from your website and Google profile. AI uses your keywords in posts and replies."
            to={locationPath(id, "keywords")}
            cta={canEdit ? "Find keywords" : "See keywords"}
            cost={canEdit ? "keyword_suggestions" : undefined}
            status={cardStatus}
            locationId={id}
            {...(keywordsStat ? { stat: keywordsStat } : {})}
          />
          <AiFeatureCard
            icon={Radar}
            title="AI Visibility"
            description="Whether ChatGPT, Gemini, Perplexity and Claude mention your business when people ask about your services."
            to="/ai-visibility"
            cta="See what's coming"
            status="soon"
          />
        </div>
      </section>

      {/* AI Settings and Facts for the AI (free, no tokens): read-only for a client user. */}
      <AiSettingsLinks locationId={id} canEdit={canEdit} />

      {canEdit ? (
        <section id="ai-costs" aria-labelledby="ai-costs-title" className="min-w-0 scroll-mt-20 rounded-xl border border-border bg-card shadow-card">
          {/* The chip sits on the title line (as in Panel), not beside the wrapped description. */}
          <div className="flex items-start gap-3 border-b border-border px-4 py-3.5 sm:px-5">
            <IconChip icon={Coins} tone="ai" size="sm" className="-mt-0.5" />
            <div className="min-w-0">
              <h2 id="ai-costs-title" className="text-[15px] font-semibold leading-6 text-foreground">
                What AI costs
              </h2>
              <p className="text-[13px] text-muted-foreground">Prices in MyPageSEO tokens, set by your plan. Every AI button shows its price before you press it.</p>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            {/* Replies and analyses: "1 token = 10 replies", the block's size from the location's counters. */}
            <AiCostTable costs={ai.costs} columns={2} blockSize={summary?.ai?.credits?.block_size} {...balance} />
          </div>
        </section>
      ) : null}

      <HowAiWorks autoReplies={autoRepliesFeature === "on"} autoPublish={autoPublishOn} />

      {buying ? <BuyTokensDialog onClose={() => setBuying(false)} /> : null}
    </>
  );
}

/**
 * The balance and what it buys, with "Buy tokens" for the owner. Review replies come in blocks of `block_size` (10)
 * per location since 2026-11-17: the replies left here plus the blocks the balance buys ("1 token = 10 replies" at the
 * default price, from the fields, never hard-coded).
 */
function TokensCard({
  balance,
  costs,
  credits,
  canBuy,
  onBuy,
}: {
  balance: number | undefined;
  costs: AiCosts;
  credits: ReplyCredits | null;
  canBuy: boolean;
  onBuy: () => void;
}) {
  const charges = (cost: number) => (cost > 0 && balance !== undefined ? Math.floor(balance / cost) : null);
  const shown = (count: number | null) => (count === null ? "—" : count.toLocaleString());
  const blockSize = credits?.block_size && credits.block_size > 0 ? credits.block_size : DEFAULT_BLOCK_SIZE;
  const replyBlocks = charges(costs.reply_drafts_per_10);
  const replies = costs.reply_drafts_per_10 <= 0 ? "Free" : replyBlocks === null ? "—" : ((credits?.replies_left ?? 0) + replyBlocks * blockSize).toLocaleString();
  const replyWords = creditsText(credits, costs, "replies");
  const lines: { label: string; value: string }[] = [
    { label: "Post drafts", value: shown(charges(costs.post_draft)) },
    { label: "AI images", value: shown(charges(costs.post_image)) },
    { label: "Review replies", value: replies },
  ];
  return (
    <section aria-labelledby="ai-tokens-title" className="flex min-w-0 flex-col rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3.5">
        <span aria-hidden className="-mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-warning-surface text-warning-foreground ring-1 ring-inset ring-warning/30">
          <Coins className="size-3.5" />
        </span>
        <h2 id="ai-tokens-title" className="text-[15px] font-semibold leading-6 text-foreground">
          Your tokens
        </h2>
      </div>
      <div className="flex-1 p-4">
        {balance === undefined ? (
          <div role="status" aria-label="Loading your tokens" className="space-y-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
        ) : (
          <>
            <p className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-foreground">{balance.toLocaleString()}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">tokens left. Enough for:</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {lines.map((line) => (
                <li key={line.label} className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">{line.label}</span>
                  <span className="font-semibold tabular-nums text-foreground">{line.value}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Review replies: {replyWords.price}. {credits ? `${replyWords.left} at this location.` : null}
            </p>
          </>
        )}
      </div>
      <div className="border-t border-border p-3">
        {canBuy ? (
          <Button className="w-full" variant="outline" onClick={onBuy}>
            <Coins aria-hidden /> Buy tokens
          </Button>
        ) : (
          <p className="px-1 text-xs text-muted-foreground">Need more? Ask the account owner to add tokens.</p>
        )}
      </div>
    </section>
  );
}

/**
 * "Nothing goes live without your say-so", mentioning automatic replies and automatic publishing only where their
 * switch is on (`GET …/reviews/auto-reply` → `feature`, a series' `auto_publish.switch`): until then neither exists.
 */
function sayItText({ autoReplies, autoPublish }: { autoReplies: boolean; autoPublish: boolean }): string {
  const replies = autoReplies
    ? "Replies reach Google when you press Send, unless you switch on automatic replies."
    : "Replies reach Google only when you press Send.";
  const posts = autoPublish
    ? "AI posts wait as drafts or for your review, unless you choose automatic publishing."
    : "AI posts wait as drafts or for your review before they go out.";
  return `${replies} ${posts}`;
}

const HOW_IT_WORKS: { icon: LucideIcon; title: string; text: ReactNode }[] = [
  {
    icon: Lock,
    title: "Only what it needs",
    text: "AI sees your public business details, your website, your own facts and keywords, and the review or post at hand, with a reviewer's first name only. Never another business's data.",
  },
  {
    icon: RotateCcw,
    title: "Failed requests are refunded",
    text: "If the AI doesn't answer, or nothing usable comes back, your tokens come back on their own. A draft you already have is reused for free.",
  },
  {
    icon: BadgeCheck,
    title: "Written to Google's rules",
    text: "Posts are checked against Google's post rules before you see them. Replies follow the reviewer's language and never argue.",
  },
];

function HowAiWorks({ autoReplies, autoPublish }: { autoReplies: boolean; autoPublish: boolean }) {
  const items = [
    { icon: MousePointerClick, title: "Nothing goes live without your say-so", text: sayItText({ autoReplies, autoPublish }) },
    ...HOW_IT_WORKS,
  ];
  return (
    <section aria-labelledby="how-ai-works-title" className="min-w-0 rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <IconChip icon={Sparkles} tone="ai" size="sm" className="-mt-0.5" />
        <div className="min-w-0">
          <h2 id="how-ai-works-title" className="text-[15px] font-semibold leading-6 text-foreground">
            How AI works here
          </h2>
          <p className="text-[13px] text-muted-foreground">You stay in charge of everything that reaches Google.</p>
        </div>
      </div>
      <ul className="grid gap-x-6 gap-y-5 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-ai-surface text-ai ring-1 ring-inset ring-ai/20">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default AiStudioPage;
