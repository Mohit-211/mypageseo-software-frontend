import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Link2,
  ListChecks,
  Newspaper,
  PenLine,
  Sparkles,
  Star,
  Swords,
  Tags,
  TrendingUp,
} from "lucide-react";
import type { LocationHeader, LocationOverview } from "@/api";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import { ScoreRing } from "@/components/layout/shared/score-ring";
import { Sparkline } from "@/components/layout/shared/sparkline";
import { RatingStars } from "@/components/dashboard/figures";
import { ReplyFooter } from "@/components/dashboard/reply-footer";
import { TILE_FOOTER_LINK as FOOTER_LINK } from "@/components/dashboard/tile-link";
import { useCanEdit } from "@/hooks/use-access";
import { useAiStatus } from "@/lib/ai/ai-status";
import { citationsUnavailableText } from "@/lib/citations/citations";
import { gradeText, plural, trendOf } from "@/lib/dashboard/format";
import { writingModeFor } from "@/lib/dashboard/replies";
import { formatShortDate } from "@/lib/datetime";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { locationPath } from "@/lib/mypageseo/section-links";
import { postsSummaryQuery } from "@/lib/posts/use-posts";
import { avgRankText } from "@/lib/rankings/format";
import { useTracking } from "@/lib/rankings/use-rankings";
import { reviewsSummaryQuery } from "@/lib/reviews/use-reviews";
import { cn } from "@/lib/utils";

function FooterLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn(FOOTER_LINK, className)}>
      {children}
    </Link>
  );
}

/** Why a section has nothing to show yet, in plain words. */
const UNAVAILABLE: Record<string, string> = {
  no_keywords: "Add the searches you want customers to find you for.",
  no_ranking_data: "Your first ranking check is on its way.",
  gbp_not_connected: "Connect Google to unlock this.",
  no_report: "Your first profile report is on its way.",
  no_competitors: "Track up to 5 nearby businesses to see who ranks above you.",
  v4_access_pending: "Waiting for Google to grant review access.",
};

function unavailableText(reason: string | undefined): string {
  return (reason && UNAVAILABLE[reason]) || "Not available yet.";
}

/**
 * The overview hub: one tile per section of the location (Keywords, Rankings, GBP, Posts, Reviews,
 * Citations, Competitors, AI Studio). Each shows its key number and opens the section; fixes that
 * can't wait (connect Google, replies waiting, failed posts) sit in the tile's footer.
 */
export function LocationModuleTiles({ location, overview, loading }: { location: LocationHeader; overview: LocationOverview | undefined; loading: boolean }) {
  const id = location.location_id;
  const connected = location.gbp_connected;
  const canEdit = useCanEdit();
  const { connect } = useGbpConnect();

  const tracking = useTracking(id);
  // Same cache keys as the Posts and Reviews pages, so moving on to them is instant.
  const posts = useQuery({ ...postsSummaryQuery(id), enabled: connected });
  const reviewsSummary = useQuery({ ...reviewsSummaryQuery(id), enabled: connected });
  const ai = useAiStatus(id);
  // Reply and post links follow what this person can write now: AI drafts, by hand, or only look.
  const writing = writingModeFor(ai);

  const connectFooter = canEdit ? (
    <button type="button" onClick={() => connect()} className={FOOTER_LINK}>
      <Link2 aria-hidden className="size-3.5" /> Connect Google
    </button>
  ) : undefined;

  /* -- keywords -- */
  const keywords = tracking.data?.tracking.keywords ?? null;
  const keywordPreview = keywords && keywords.length > 0 ? keywords.slice(0, 2).map((keyword) => `“${keyword.text}”`).join(", ") : null;

  /* -- rankings -- */
  const rankings = overview?.rankings;
  const trend = rankings?.available ? rankings.trend.map((point) => point.overall_avg_rank) : [];

  /* -- GBP -- */
  const gbp = overview?.gbp;
  const performance = overview?.performance;

  /* -- posts -- */
  const postStats = posts.data?.stats;
  const postProblems = (postStats?.failed ?? 0) + (postStats?.rejected ?? 0);

  /* -- reviews -- */
  const reviews = overview?.reviews;
  // "Need a reply": every review without one (the Reviews page's "Needs reply" count). "Urgent": the
  // unanswered 1–3★ and flagged ones among them (`awaiting_attention`).
  const stats = reviewsSummary.data?.stats ?? null;
  // The overview's own `unreplied` is uncapped since 2026-11-17 (the Reviews page's count), so it stands
  // in whenever the Reviews summary has no count (Google not connected, the call failed, no stats yet).
  // While the summary loads, the footer waits for it.
  const summaryLoading = connected && reviewsSummary.isPending;
  const overviewUnreplied = reviews?.available ? reviews.unreplied : null;
  const unreplied = stats ? stats.unreplied : overviewUnreplied;
  const urgent = stats?.awaiting_attention ?? 0;
  const draftsPending = stats?.drafts_pending ?? 0;

  /* -- citations, competitors -- */
  const citations = overview?.citations;
  const competitors = overview?.competitors;
  const tracked = tracking.data?.tracking.competitors.length ?? (competitors?.available ? competitors.tracked : null);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        label="Keywords"
        icon={Tags}
        tone="keywords"
        to={locationPath(id, "keywords")}
        loading={tracking.isPending}
        value={keywords ? keywords.length.toLocaleString() : "—"}
        hint={
          keywordPreview ? (
            <>
              {keywordPreview}
              {keywords && keywords.length > 2 ? ` and ${keywords.length - 2} more` : ""}
            </>
          ) : (
            UNAVAILABLE.no_keywords
          )
        }
        footer="Rankings, AI posts and AI replies use them."
      />

      <KpiTile
        label="Rankings"
        icon={TrendingUp}
        tone="rankings"
        to={locationPath(id, "rankings")}
        loading={loading}
        value={rankings?.available ? avgRankText(rankings.overall_avg_rank, rankings.overall_status, rankings.overall_display) : "—"}
        trend={rankings?.available ? trendOf(rankings.change, { digits: 1 }) : undefined}
        hint={
          rankings?.available
            ? `Average Google Maps rank · checked ${formatShortDate(rankings.run_at)}`
            : unavailableText(rankings?.reason)
        }
        footer={
          trend.filter((value) => value !== null).length >= 2 ? (
            <span className="flex items-center justify-between gap-3">
              <span>Last {trend.length} checks</span>
              <Sparkline values={trend} lowerIsBetter width={112} height={26} className="text-chart-1" />
            </span>
          ) : undefined
        }
      />

      <KpiTile
        label="GBP"
        icon={Building2}
        tone="gbp"
        to={locationPath(id, "gbp")}
        loading={loading}
        value={gbp?.available ? gradeText(gbp.score, gbp.grade) : "—"}
        visual={gbp?.available && gbp.score !== null ? <ScoreRing value={gbp.score} size="md" label="Profile score" /> : undefined}
        hint={
          gbp?.available ? (
            gbp.top_fixes[0] ? (
              // "Profile score" names the grade and the ring's number.
              <>
                Profile score · Top fix: <span className="font-medium text-foreground">{gbp.top_fixes[0].label}</span>
              </>
            ) : (
              "Your Google Business Profile score."
            )
          ) : gbp?.reason === "gbp_not_connected" ? (
            "Connect Google for your profile score, views and searches."
          ) : (
            unavailableText(gbp?.reason)
          )
        }
        footer={
          performance?.available ? (
            <span>
              <span className="font-semibold text-foreground">{(performance.impressions ?? 0).toLocaleString()}</span> views
              {performance.impressions_change != null ? ` (${performance.impressions_change >= 0 ? "+" : "−"}${Math.abs(performance.impressions_change * 100).toFixed(1)}%)` : ""} ·{" "}
              {(performance.actions ?? 0).toLocaleString()} actions, last 28 days
            </span>
          ) : gbp && !gbp.available && gbp.reason === "gbp_not_connected" ? (
            connectFooter
          ) : undefined
        }
      />

      <KpiTile
        label="Posts"
        icon={Newspaper}
        tone="posts"
        to={locationPath(id, "gbp/posts")}
        loading={connected && posts.isPending}
        value={connected && postStats ? postStats.published_last_30_days.toLocaleString() : "—"}
        hint={
          !connected
            ? "Posts go live on your Google profile. Connect Google to start."
            : postStats
              ? `Published in the last 30 days${postStats.last_published_at ? ` · last on ${formatShortDate(postStats.last_published_at)}` : ""}`
              : "Posts couldn't be loaded."
        }
        footer={
          !connected ? (
            connectFooter
          ) : postProblems > 0 ? (
            <FooterLink to={locationPath(id, "gbp/posts", "?tab=problems")} className="text-warning-foreground hover:text-warning-foreground">
              <AlertTriangle aria-hidden className="size-3.5" /> {plural(postProblems, "post")} didn't publish
            </FooterLink>
          ) : postStats?.next_scheduled_at ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock aria-hidden className="size-3.5 text-primary" /> Next post {formatShortDate(postStats.next_scheduled_at)}
            </span>
          ) : postStats && writing !== "view" ? (
            // The editor opens straight away, so only for people who can save a post.
            <FooterLink to={locationPath(id, "gbp/posts", "?compose=1")}>
              <PenLine aria-hidden className="size-3.5" /> Write a post
            </FooterLink>
          ) : undefined
        }
      />

      <KpiTile
        label="Reviews"
        icon={Star}
        tone="reputation"
        to={locationPath(id, "reputation")}
        loading={loading}
        value={
          reviews?.available ? (
            <span className="inline-flex items-center gap-2.5">
              {reviews.rating === null ? "—" : reviews.rating.toFixed(1)}
              <RatingStars rating={reviews.rating} />
            </span>
          ) : (
            "—"
          )
        }
        hint={
          reviews?.available ? (
            <>
              {reviews.count === null ? "No reviews yet" : plural(reviews.count, "review")}
              {/* Unanswered 1–3★ or flagged: the ones to answer first. */}
              {urgent > 0 && (unreplied ?? 0) > 0 ? (
                <>
                  {" · "}
                  <span className="whitespace-nowrap font-medium text-warning-foreground">{urgent.toLocaleString()} urgent</span>
                </>
              ) : null}
            </>
          ) : reviews?.reason === "gbp_not_connected" ? (
            "Connect Google to read and answer your reviews here."
          ) : (
            unavailableText(reviews?.reason)
          )
        }
        footer={
          !reviews?.available ? (
            reviews?.reason === "gbp_not_connected" ? connectFooter : undefined
          ) : summaryLoading ? undefined : unreplied === null ? undefined : unreplied > 0 ? (
            <ReplyFooter locationId={id} unreplied={unreplied} writing={writing} />
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-success">
              <CheckCircle2 aria-hidden className="size-3.5" /> All caught up
            </span>
          )
        }
      />

      <KpiTile
        label="Citations"
        icon={ListChecks}
        tone="citations"
        to={locationPath(id, "citations")}
        loading={loading}
        value={citations?.available ? gradeText(citations.score, citations.grade) : "—"}
        trend={citations?.available && citations.score !== null ? trendOf(citations.score_change, { suffix: " pts" }) : undefined}
        visual={citations?.available && citations.score !== null ? <ScoreRing value={citations.score} size="md" label="Citation score" /> : undefined}
        hint={
          citations?.available
            ? [
                citations.counts.nap_wrong > 0 ? `${citations.counts.nap_wrong} with wrong details` : null,
                citations.counts.not_found > 0 ? `${citations.counts.not_found} not listed` : null,
              ]
                .filter(Boolean)
                .join(" · ") || `${plural(citations.listings, "listing")}, all correct`
            : citations
              ? citationsUnavailableText(citations.reason)
              : "Directory listings, checked by the MyPageSEO team."
        }
      />

      <KpiTile
        label="Competitors"
        icon={Swords}
        tone="competitors"
        to={locationPath(id, "competitors")}
        loading={loading && tracking.isPending}
        value={tracked === null ? "—" : tracked.toLocaleString()}
        hint={
          tracked === 0 || (competitors && !competitors.available) ? (
            UNAVAILABLE.no_competitors
          ) : competitors?.available && competitors.best_competitor ? (
            <>
              Strongest nearby: <span className="font-medium text-foreground">{competitors.best_competitor.name}</span>
            </>
          ) : (
            "Tracked businesses nearby."
          )
        }
        footer={competitors?.available && competitors.compared > 0 ? `${plural(competitors.compared, "business", "businesses")} compared on Google` : undefined}
      />

      <KpiTile
        label="AI Studio"
        icon={Sparkles}
        tone="ai"
        to={locationPath(id, "ai")}
        loading={ai.state === "checking"}
        className="bg-linear-to-br from-ai-surface via-card to-card"
        value={ai.state === "ready" ? "Ready" : ai.state === "off" ? "Almost ready" : ai.state === "paused" ? "Paused" : "Available"}
        hint={
          !canEdit
            ? // Read-only (a client's login): the agency writes and sends; they can follow along.
              draftsPending > 0
              ? `${plural(draftsPending, "reply draft")} waiting for your agency to send.`
              : "Posts and review replies your agency prepares with AI show up here."
            : ai.state === "off"
              ? "AI writing is being switched on. Until then, write posts and replies yourself."
              : ai.state === "paused"
                ? `Today's AI limit is used up.${ai.resumesAt ? ` Back at ${ai.resumesAt}.` : ""}`
                : draftsPending > 0
                  ? `${plural(draftsPending, "reply draft")} waiting for your OK.`
                  : "Write posts and draft review replies in seconds. Nothing goes out without you."
        }
        footer={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <FooterLink to={locationPath(id, "ai/posts")} className="text-ai hover:text-ai-hover">
              AI Posts
            </FooterLink>
            {/* With drafts waiting, open the reply queue on them. */}
            <FooterLink to={locationPath(id, "ai/replies", draftsPending > 0 ? "?filter=drafts" : "")} className="text-ai hover:text-ai-hover">
              AI Review Replies <ArrowRight aria-hidden className="size-3.5" />
            </FooterLink>
          </span>
        }
      />
    </div>
  );
}
