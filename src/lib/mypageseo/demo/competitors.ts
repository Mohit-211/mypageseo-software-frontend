/**
 * Demo dataset for the Competitors screens. Derived from the shared demo
 * competitor and keyword facts in `entities.ts` so summaries, comparison
 * tables and rankings all reconcile with the rest of the demo account.
 */
import { pickInt, seedFrom } from "./demo-mode";
import {
  DEMO_LAST_SYNC,
  demoCompetitors,
  demoKeywords,
  demoLocation,
  type DemoCompetitor,
} from "./entities";
import type {
  CompetitiveInsight,
  CompetitiveSummary,
  CompetitorDetailData,
  CompetitorGap,
  CompetitorKeywordComparison,
  CompetitorProfile,
  CompetitorRow,
  CompetitorSource,
  CompetitorTrendPoint,
  CompetitorsCapabilities,
  CompetitorsData,
  MetricComparison,
} from "../../competitors/competitors";

const CAPABILITIES: CompetitorsCapabilities = {
  canSearch: true,
  canFilterByCategory: true,
  canTrackCompetitors: true,
  canRemoveCompetitors: true,
  hasDetailView: true,
};

const DETAIL_CAPABILITIES = { canEdit: true, canUntrack: true };

function sourceFor(competitor: DemoCompetitor): CompetitorSource {
  return seedFrom(competitor.id, "source") % 3 === 0 ? "discovered" : "tracked";
}

function toRow(locationId: string, competitor: DemoCompetitor): CompetitorRow {
  const seed = seedFrom(locationId, competitor.id, "row");
  return {
    id: competitor.id,
    businessName: competitor.name,
    isSelectedBusiness: false,
    category: competitor.primaryCategory,
    area: null,
    source: sourceFor(competitor),
    averagePosition: competitor.averageRank,
    visibility: pickInt(seed, 20, 90),
    reviewCount: competitor.reviewCount,
    rating: competitor.rating,
    citationCoverage: Math.round((competitor.citationCount / 96) * 100),
    gbpHealth: pickInt(seed + 3, 35, 96),
  };
}

export function demoCompetitorsData(locationId?: string | null): CompetitorsData {
  const location = demoLocation(locationId);
  const competitors = demoCompetitors(location.id);
  const rows = competitors.map((competitor) => toRow(location.id, competitor));
  const selfRow: CompetitorRow = {
    id: `self_${location.id}`,
    businessName: location.businessName,
    isSelectedBusiness: true,
    category: location.primaryCategory,
    area: location.area,
    source: null,
    averagePosition: location.averageRank,
    visibility: location.visibility,
    reviewCount: location.reviewCount,
    rating: location.rating,
    citationCoverage: Math.round((location.citationHealth / 100) * 100),
    gbpHealth: location.gbpHealth,
  };

  const allRows = [selfRow, ...rows];
  const avgCompetitorPosition =
    Math.round((rows.reduce((sum, r) => sum + (r.averagePosition ?? 0), 0) / Math.max(1, rows.length)) * 10) / 10;
  const avgCompetitorReviews = Math.round(
    rows.reduce((sum, r) => sum + (r.reviewCount ?? 0), 0) / Math.max(1, rows.length),
  );
  const sortedByPosition = [...allRows].sort((a, b) => (a.averagePosition ?? 999) - (b.averagePosition ?? 999));
  const relativeRank = sortedByPosition.findIndex((r) => r.isSelectedBusiness) + 1;

  const summary: CompetitiveSummary = {
    trackedCompetitors: rows.length,
    averageCompetitorPosition: avgCompetitorPosition,
    yourAveragePosition: location.averageRank,
    relativeRank,
    yourReviewCount: location.reviewCount,
    averageCompetitorReviewCount: avgCompetitorReviews,
  };

  const strongest = [...rows].sort((a, b) => (a.averagePosition ?? 999) - (b.averagePosition ?? 999))[0] ?? null;
  const mostReviewed = [...rows].sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0))[0] ?? null;

  const insights: CompetitiveInsight[] = [];
  if (strongest) {
    const tone = (strongest.averagePosition ?? 999) < (location.averageRank ?? 999) ? "gap" : "advantage";
    insights.push({
      id: `insight_${strongest.id}_position`,
      title: `${strongest.businessName} ranks ${tone === "gap" ? "ahead of" : "behind"} you on average`,
      detail: `Average position ${strongest.averagePosition ?? "—"} versus your ${location.averageRank} across tracked keywords.`,
      tone,
      competitorId: strongest.id,
    });
  }
  if (mostReviewed) {
    const tone = (mostReviewed.reviewCount ?? 0) > location.reviewCount ? "gap" : "advantage";
    insights.push({
      id: `insight_${mostReviewed.id}_reviews`,
      title: `${mostReviewed.businessName} has ${tone === "gap" ? "more" : "fewer"} reviews than you`,
      detail: `${mostReviewed.reviewCount?.toLocaleString() ?? "—"} reviews versus your ${location.reviewCount.toLocaleString()}.`,
      tone,
      competitorId: mostReviewed.id,
    });
  }
  insights.push({
    id: `insight_${location.id}_gbp`,
    title: "Your Google Business Profile health is above the tracked average",
    detail: `Your GBP health score is ${location.gbpHealth}; tracked competitors average ${Math.round(rows.reduce((s, r) => s + (r.gbpHealth ?? 0), 0) / Math.max(1, rows.length))}.`,
    tone: location.gbpHealth >= Math.round(rows.reduce((s, r) => s + (r.gbpHealth ?? 0), 0) / Math.max(1, rows.length)) ? "advantage" : "gap",
    competitorId: null,
  });

  return {
    status: "ready",
    lastCheckedAt: DEMO_LAST_SYNC,
    summary,
    competitors: allRows,
    insights,
    capabilities: CAPABILITIES,
  };
}

function metric(
  id: string,
  label: string,
  yours: number | null,
  theirs: number | null,
  unit: MetricComparison["unit"],
  lowerIsBetter = false,
): MetricComparison {
  return { id, label, yours, theirs, unit, lowerIsBetter };
}

export function demoCompetitorDetail(competitorId: string, locationId?: string | null): CompetitorDetailData {
  const location = demoLocation(locationId);
  const competitors = demoCompetitors(location.id);
  const competitor = competitors.find((c) => c.id === competitorId) ?? null;

  if (!competitor) {
    return {
      status: "not_found",
      competitor: null,
      lastUpdatedAt: null,
      metrics: [],
      keywords: [],
      reviewMetrics: [],
      citationMetrics: [],
      gbpMetrics: [],
      websiteMetrics: [],
      gaps: [],
      trend: [],
      capabilities: DETAIL_CAPABILITIES,
    };
  }

  const profile: CompetitorProfile = {
    id: competitor.id,
    businessName: competitor.name,
    category: competitor.primaryCategory,
    area: location.area,
    website: competitor.website,
    source: sourceFor(competitor),
    score: null,
    scoreExplanation: null,
  };

  const seed = seedFrom(location.id, competitor.id, "gbp");
  const competitorGbpHealth = pickInt(seed, 35, 96);
  const competitorVisibility = pickInt(seed + 2, 20, 90);

  const metrics: MetricComparison[] = [
    metric("avg_position", "Average position", location.averageRank, competitor.averageRank, "position", true),
    metric("visibility", "Visibility score", location.visibility, competitorVisibility, "score"),
    metric("local_pack", "Local pack coverage", location.localPackCoverage, competitor.localPackShare, "percent"),
  ];

  const keywords = demoKeywords(location.id);
  const keywordComparisons: CompetitorKeywordComparison[] = keywords.slice(0, 12).map((keyword) => {
    const kseed = seedFrom(location.id, keyword.id, competitor.id);
    const raw = Math.round(competitor.averageRank + pickInt(kseed, -6, 8));
    const theirPosition = raw < 1 ? 1 : raw > 40 ? null : raw;
    const prevRaw = theirPosition === null ? null : theirPosition + pickInt(kseed + 5, -3, 3);
    const theirPreviousPosition = prevRaw === null ? null : Math.max(1, prevRaw);
    return {
      id: keyword.id,
      keyword: keyword.keyword,
      resultType: keyword.resultType,
      yourPosition: keyword.currentPosition,
      yourPreviousPosition: keyword.previousPosition,
      theirPosition,
      theirPreviousPosition,
    };
  });

  const reviewMetrics: MetricComparison[] = [
    metric("reviews", "Review count", location.reviewCount, competitor.reviewCount, "count"),
    metric("rating", "Average rating", location.rating, competitor.rating, "rating"),
  ];

  const citationMetrics: MetricComparison[] = [
    metric("citation_count", "Directory listings", location.citationTotal, competitor.citationCount, "count"),
    metric("citation_health", "Citation health", location.citationHealth, Math.round((competitor.citationCount / 96) * 100), "percent"),
  ];

  const gbpMetrics: MetricComparison[] = [
    metric("gbp_health", "GBP health score", location.gbpHealth, competitorGbpHealth, "score"),
    metric("photos", "Photo count", location.photoCount, competitor.photoCount, "count"),
  ];

  const websiteMetrics: MetricComparison[] = [
    metric("domain_authority", "Domain authority", null, competitor.domainAuthority, "score"),
    metric("backlinks", "Backlinks", null, competitor.backlinks, "count"),
    metric("linking_domains", "Linking domains", null, competitor.linkingDomains, "count"),
  ];

  const gaps: CompetitorGap[] = [];
  if (competitor.reviewCount > location.reviewCount) {
    gaps.push({
      id: `${competitor.id}_gap_reviews`,
      title: "Review volume gap",
      detail: `${competitor.name} has ${(competitor.reviewCount - location.reviewCount).toLocaleString()} more reviews than your location.`,
      tone: "gap",
    });
  } else {
    gaps.push({
      id: `${competitor.id}_adv_reviews`,
      title: "Review volume advantage",
      detail: `You have ${(location.reviewCount - competitor.reviewCount).toLocaleString()} more reviews than ${competitor.name}.`,
      tone: "advantage",
    });
  }
  if (competitor.averageRank < location.averageRank) {
    gaps.push({
      id: `${competitor.id}_gap_position`,
      title: "Ranking gap",
      detail: `${competitor.name} ranks ahead of you on average across tracked keywords.`,
      tone: "gap",
    });
  } else {
    gaps.push({
      id: `${competitor.id}_adv_position`,
      title: "Ranking advantage",
      detail: `You rank ahead of ${competitor.name} on average across tracked keywords.`,
      tone: "advantage",
    });
  }

  const trend: CompetitorTrendPoint[] = Array.from({ length: 6 }).map((_, index) => {
    const tseed = seedFrom(location.id, competitor.id, "trend", index);
    return {
      period: `Period ${index + 1}`,
      yourAveragePosition: Math.max(1, Math.round(location.averageRank + pickInt(tseed, -3, 3))),
      theirAveragePosition: Math.max(1, Math.round(competitor.averageRank + pickInt(tseed + 2, -3, 3))),
    };
  });

  return {
    status: "ready",
    competitor: profile,
    lastUpdatedAt: DEMO_LAST_SYNC,
    metrics,
    keywords: keywordComparisons,
    reviewMetrics,
    citationMetrics,
    gbpMetrics,
    websiteMetrics,
    gaps,
    trend,
    capabilities: DETAIL_CAPABILITIES,
  };
}
