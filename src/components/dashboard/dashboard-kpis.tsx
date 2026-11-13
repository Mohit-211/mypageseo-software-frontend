import { Building2, CheckCircle2, Link2, ListChecks, MapPin, MessageSquareReply, Star, TrendingUp, Users } from "lucide-react";
import type { LocationStatus } from "@/api";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import { ScoreRing } from "@/components/layout/shared/score-ring";
import { Sparkline } from "@/components/layout/shared/sparkline";
import { RatingStars } from "@/components/dashboard/figures";
import { ReplyFooter } from "@/components/dashboard/reply-footer";
import { TILE_FOOTER_LINK as FOOTER_LINK } from "@/components/dashboard/tile-link";
import { useAccess, useCanEdit } from "@/hooks/use-access";
import type { AgencyDashboardModel, BusinessDashboardModel } from "@/lib/dashboard/dashboard-data";
import { gradeText, plural, signed, trendOf } from "@/lib/dashboard/format";
import type { WritingMode } from "@/lib/dashboard/replies";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { LOCATION_STATUS_ORDER } from "@/lib/locations/location-status";
import { locationPath } from "@/lib/mypageseo/section-links";

/** The rank trend under the average rank: a small line, flipped so "up" means better. */
function RankTrendFooter({ values }: { values: (number | null)[] }) {
  if (values.filter((value) => value !== null).length < 2) return null;
  return (
    <span className="flex items-center justify-between gap-3">
      <span>Last {values.length} checks</span>
      <Sparkline values={values} lowerIsBetter width={112} height={26} className="text-chart-1" />
    </span>
  );
}

/* ----------------------------------------------------------------------- business -- */

/**
 * The business dashboard's four health numbers. Each opens the page that explains it: the location's
 * own page when one location is in view, else the locations table sorted by that number.
 */
export function BusinessKpis({
  model,
  focusId,
  topFix,
  writing = "ai",
}: {
  model: BusinessDashboardModel;
  focusId: string | null;
  topFix: string | null;
  /** What the person can write right now: the reply link drafts with AI, opens the list to reply, or only to look. */
  writing?: WritingMode;
}) {
  const { connect } = useGbpConnect();
  const canEdit = useCanEdit();
  const { rank, profile, reviews, citations } = model;
  const days = model.rangeDays;

  // "Need a reply" is every review without one (the Reviews page's "Needs reply" count).
  const reviewsFooter = (() => {
    if (!reviews?.available) return undefined;
    const unreplied = reviews.unreplied ?? 0;
    if (unreplied === 0) {
      return (
        <span className="inline-flex items-center gap-1 font-medium text-success">
          <CheckCircle2 aria-hidden className="size-3.5" /> Every review has a reply
        </span>
      );
    }
    if (!focusId) {
      // Across several locations there's no single list to open; each location's Reviews page has its own.
      return (
        <span className="inline-flex items-center gap-1 font-medium text-warning-foreground">
          <MessageSquareReply aria-hidden className="size-3.5" />
          {plural(unreplied, "review")} {unreplied === 1 ? "needs" : "need"} a reply
        </span>
      );
    }
    return <ReplyFooter locationId={focusId} unreplied={unreplied} writing={writing} />;
  })();
  const urgent = reviews?.available ? (reviews.urgent ?? 0) : 0;

  return (
    <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        label="Average rank"
        icon={TrendingUp}
        tone="rankings"
        value={rank?.text ?? "—"}
        trend={trendOf(rank?.change, { digits: 1 })}
        hint={
          rank?.top3 != null ? (
            <>
              In Google Maps' top 3 for <span className="font-semibold text-foreground">{rank.top3}%</span> of searches
              {rank.top3Change ? ` (${signed(rank.top3Change)} pts)` : ""}
            </>
          ) : rank ? (
            "Your average place on Google Maps. 1 is the top."
          ) : (
            "Your first ranking check is on its way."
          )
        }
        footer={rank ? <RankTrendFooter values={rank.trend.map((point) => point.value)} /> : undefined}
        to={focusId ? locationPath(focusId, "rankings") : "/locations?sort=rank"}
      />

      <KpiTile
        label="Profile score"
        icon={Building2}
        tone="gbp"
        value={profile.available ? gradeText(profile.score, profile.grade) : "—"}
        trend={profile.available && profile.score !== null ? trendOf(profile.change, { suffix: " pts" }) : undefined}
        visual={profile.available && profile.score !== null ? <ScoreRing value={profile.score} size="md" label="Profile score" /> : undefined}
        hint={
          profile.available ? (
            topFix ? (
              <>
                Top fix: <span className="font-medium text-foreground">{topFix}</span>
              </>
            ) : (
              "How complete, active and well-reviewed your Google profile is."
            )
          ) : profile.reason === "gbp_not_connected" ? (
            "Connect your Google Business Profile to get a profile score."
          ) : (
            "Ready after the first sync with Google."
          )
        }
        footer={
          !profile.available && profile.reason === "gbp_not_connected" && canEdit ? (
            <button type="button" onClick={() => connect()} className={FOOTER_LINK}>
              <Link2 aria-hidden className="size-3.5" /> Connect Google
            </button>
          ) : undefined
        }
        {...(profile.available ? { to: focusId ? locationPath(focusId, "gbp/audit") : "/locations?sort=gbp_score&order=desc" } : {})}
      />

      <KpiTile
        label="Reviews"
        icon={Star}
        tone="reputation"
        value={
          reviews?.available ? (
            <span className="inline-flex items-center gap-2.5">
              {reviews.rating === null ? "—" : reviews.rating.toFixed(1)}
              <RatingStars rating={reviews.rating} />
            </span>
          ) : reviews && reviews.publicRating !== null ? (
            <span className="inline-flex items-center gap-2.5">
              {reviews.publicRating.toFixed(1)}
              <RatingStars rating={reviews.publicRating} />
            </span>
          ) : (
            "—"
          )
        }
        // A rating moves in hundredths all the time; only a visible step (0.05+) earns a chip.
        trend={reviews?.available && Math.abs(reviews.ratingChange ?? 0) >= 0.05 ? trendOf(reviews.ratingChange, { digits: 2 }) : undefined}
        hint={
          reviews?.available ? (
            <>
              {reviews.count === null ? "No reviews yet" : plural(reviews.count, "review")}
              {reviews.newInRange ? ` · +${reviews.newInRange.toLocaleString()} in the last ${days} days` : ""}
              {/* Unanswered 1–3★ or flagged: the ones to answer first. */}
              {urgent > 0 ? (
                <>
                  {" · "}
                  <span className="whitespace-nowrap font-medium text-warning-foreground">{urgent.toLocaleString()} urgent</span>
                </>
              ) : null}
            </>
          ) : reviews?.reason === "v4_access_pending" ? (
            "Waiting for Google to grant review access."
          ) : reviews?.reason === "gbp_not_connected" ? (
            `Public Google rating${reviews.publicCount ? ` from ${plural(reviews.publicCount, "review")}` : ""}. Connect Google to answer reviews.`
          ) : (
            "Reviews appear after the first sync with Google."
          )
        }
        footer={reviewsFooter}
        to={focusId ? locationPath(focusId, "reputation") : "/locations?sort=rating&order=desc"}
      />

      <KpiTile
        label="Citation score"
        icon={ListChecks}
        tone="citations"
        value={citations?.available ? gradeText(citations.score, citations.grade) : "—"}
        trend={citations?.available && citations.score !== null ? trendOf(citations.change, { suffix: " pts" }) : undefined}
        visual={citations?.available && citations.score !== null ? <ScoreRing value={citations.score} size="md" label="Citation score" /> : undefined}
        hint={
          citations?.available
            ? [citations.napWrong > 0 ? `${citations.napWrong} with wrong details` : null, citations.notFound > 0 ? `${citations.notFound} not listed` : null]
                .filter(Boolean)
                .join(" · ") || citations.caption
            : (citations?.caption ?? "Directory listings, checked by the MyPageSEO team.")
        }
        to={focusId ? locationPath(focusId, "citations") : "/locations?sort=citation_score&order=desc"}
      />
    </section>
  );
}

/* ------------------------------------------------------------------------- agency -- */

const STATUS_PHRASE: Record<LocationStatus, string> = {
  active: "active",
  setup_required: "need setup",
  reconnect_required: "to reconnect",
  gbp_disconnected: "disconnected",
  gbp_not_connected: "without a Google profile",
};

/** The agency's portfolio in five numbers. */
export function AgencyKpis({ model }: { model: AgencyDashboardModel }) {
  const canViewClients = useAccess().can("clients.view");
  const statusLine = LOCATION_STATUS_ORDER.map((status) => {
    const value = model.statusCounts[status] ?? 0;
    return value > 0 ? `${value} ${STATUS_PHRASE[status]}` : null;
  })
    .filter(Boolean)
    .join(" · ");

  return (
    // Five tiles: 3 + 2 on a 6-column grid at lg (no hole), one row at xl, 2 + 2 + 1 (wide) on tablets.
    <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-5">
      <KpiTile
        className="lg:col-span-2 xl:col-span-1"
        label="Clients"
        icon={Users}
        tone="clients"
        value={model.clients.toLocaleString()}
        hint={model.clients === 0 ? "Group locations by client for reports and client access." : `${plural(model.locations, "location")} in total`}
        {...(canViewClients ? { to: "/clients" } : {})}
      />
      <KpiTile
        className="lg:col-span-2 xl:col-span-1"
        label="Locations"
        icon={MapPin}
        tone="locations"
        value={model.locations.toLocaleString()}
        hint={statusLine || "No locations yet"}
        to="/locations"
      />
      {/* Portfolio averages: the label stays short (tiles are narrow), the hint says it's an average. */}
      <KpiTile
        className="lg:col-span-2 xl:col-span-1"
        label="Top 3 rate"
        icon={TrendingUp}
        tone="rankings"
        value={model.top3.value === null ? "—" : `${model.top3.value}%`}
        trend={trendOf(model.top3.change, { suffix: " pts" })}
        hint={
          model.rank
            ? `Average share of searches in Google Maps' top 3 · avg. rank ${model.rank.text}`
            : "Average share of searches in Google Maps' top 3."
        }
        to="/locations?sort=rank"
      />
      <KpiTile
        className="lg:col-span-3 xl:col-span-1"
        label="Profile score"
        icon={Building2}
        tone="gbp"
        value={gradeText(model.profile.value)}
        trend={model.profile.value !== null ? trendOf(model.profile.change, { suffix: " pts" }) : undefined}
        visual={model.profile.value !== null ? <ScoreRing value={model.profile.value} size="md" label="Average profile score" /> : undefined}
        hint={model.profile.value === null ? "No profile scores yet." : "Average of the locations with a Google profile."}
        to="/locations?sort=gbp_score&order=desc"
      />
      <KpiTile
        className="sm:col-span-2 lg:col-span-3 xl:col-span-1"
        label="Citation score"
        icon={ListChecks}
        tone="citations"
        value={gradeText(model.citationScore)}
        visual={model.citationScore !== null ? <ScoreRing value={model.citationScore} size="md" label="Average citation score" /> : undefined}
        hint={model.citationScore === null ? "No listings checked yet." : "Average of the locations with checked listings."}
        to="/locations?sort=citation_score&order=desc"
      />
    </section>
  );
}
