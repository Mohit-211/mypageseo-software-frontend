/**
 * Demo dashboard data derived from the shared demo entities, so the numbers on
 * the dashboard reconcile with Rankings, GBP, Reviews, Citations, Competitors
 * and the Locations table.
 */
import type {
  AgencyDashboard,
  BusinessDashboard,
  CompetitorRow,
  GbpFactor,
  PortfolioRow,
  RankSeriesPoint,
  RecommendedAction,
} from "../../dashboard/dashboard-data";
import {
  DEMO_CLIENTS,
  DEMO_LOCATIONS,
  DEMO_PRIMARY_LOCATION_ID,
  demoCompetitors,
  demoKeywords,
  demoLocation,
} from "./entities";

function rankMovement(locationId: string) {
  const keywords = demoKeywords(locationId);
  let improved = 0;
  let declined = 0;
  let unchanged = 0;
  keywords.forEach((k) => {
    if (k.currentPosition === null || k.previousPosition === null) {
      unchanged += 1;
      return;
    }
    const delta = k.previousPosition - k.currentPosition;
    if (delta > 0) improved += 1;
    else if (delta < 0) declined += 1;
    else unchanged += 1;
  });
  return { improved, declined, unchanged, tracked: keywords.length };
}

/**
 * Deterministic weekly ranking history. A small repeating wobble is applied so
 * the trend reads like collected data rather than a straight interpolation.
 */
function rankSeries(averageRank: number, change: number): RankSeriesPoint[] {
  const start = averageRank - change * 4;
  const wobble = [0, 0.6, -0.4, 0.9, -0.7, 0.3, -0.5, 0];
  return Array.from({ length: 8 }, (_, index) => {
    const progress = index / 7;
    const current = start + (averageRank - start) * progress + (wobble[index] ?? 0);
    const previous = current + 1.1 + progress * 0.8 + (wobble[(index + 3) % 8] ?? 0) * 0.5;
    return {
      period: `Wk ${index + 1}`,
      averageRank: Number(Math.max(1, current).toFixed(1)),
      previousAverageRank: Number(Math.max(1, previous).toFixed(1)),
    };
  });
}

export function demoBusinessDashboard(locationId?: string | null): BusinessDashboard {
  const location = demoLocation(locationId ?? DEMO_PRIMARY_LOCATION_ID);
  const movement = rankMovement(location.id);
  const competitors = demoCompetitors(location.id).slice(0, 3);

  const gbpFactors: GbpFactor[] = [
    {
      label: "Profile information",
      score: 94,
      status: "healthy",
      detail: `Primary category set to ${location.primaryCategory}, services complete`,
    },
    {
      label: "NAP consistency",
      score: location.citationHealth,
      status: location.citationHealth >= 80 ? "healthy" : "attention",
      detail: `${location.citationIssues} of ${location.citationTotal} directories need attention`,
    },
    {
      label: "Opening hours",
      score: 88,
      status: "healthy",
      detail: "Holiday hours published for 2 upcoming dates",
    },
    {
      label: "Photos",
      score: location.photoCount > 120 ? 82 : 58,
      status: location.photoCount > 120 ? "healthy" : "attention",
      detail: `${location.photoCount} photos on the profile, newest 12 days ago`,
    },
    {
      label: "Reviews",
      score: 77,
      status: location.unansweredReviews > 5 ? "attention" : "healthy",
      detail: `${location.unansweredReviews} reviews awaiting a response`,
    },
    {
      label: "Duplicates",
      score: 40,
      status: "critical",
      detail: "1 possible duplicate listing detected on Bing Places",
    },
  ];

  const competitorRows: CompetitorRow[] = [
    {
      name: location.businessName,
      isYou: true,
      averageRank: location.averageRank,
      rating: location.rating,
      reviews: location.reviewCount,
      photos: location.photoCount,
    },
    ...competitors.map((c) => ({
      name: c.name,
      averageRank: c.averageRank,
      rating: c.rating,
      reviews: c.reviewCount,
      photos: c.photoCount,
    })),
  ];

  const actions: RecommendedAction[] = [
    {
      id: "act_duplicate",
      title: "Resolve a possible duplicate listing",
      reason: "A duplicate profile can split rankings and reviews for this location.",
      severity: "critical",
      to: "/gbp/audit",
      actionLabel: "Open GBP Audit",
    },
    {
      id: "act_reviews",
      title: `Respond to ${location.unansweredReviews} unanswered reviews`,
      reason: "Oldest unanswered review is 12 days old; response rate affects reputation signals.",
      severity: "attention",
      to: "/gbp/reviews",
      actionLabel: "Open Reviews",
    },
    {
      id: "act_keywords",
      title: `Investigate ${movement.declined} declining keywords`,
      reason: "Positions dropped three or more places this period, mostly on service terms.",
      severity: "attention",
      to: "/rankings/keywords",
      actionLabel: "Open Keywords",
    },
    {
      id: "act_citations",
      title: `Fix NAP mismatches on ${location.citationIssues} directories`,
      reason: "Inconsistent name, address or phone data weakens citation health.",
      severity: "info",
      to: "/citations",
      actionLabel: "Open Citations",
    },
  ];

  return {
    kind: "business",
    comparisonLabel: "vs. previous 28 days",
    visibilityScore: {
      label: "Local Visibility Score",
      value: location.visibility,
      change: location.visibilityChange,
    },
    averageRank: {
      label: "Average Rank",
      value: location.averageRank,
      change: location.averageRankChange,
    },
    gbpHealth: { label: "GBP Health Score", value: location.gbpHealth, change: 3 },
    reviewRating: { label: "Review Rating", value: location.rating, change: 0.1 },
    reviewCount: location.reviewCount,
    citationHealth: { label: "Citation Health", value: location.citationHealth, change: -2 },
    rankMovement: movement,
    rankSeries: rankSeries(location.averageRank, location.averageRankChange),
    gbpFactors,
    reviews: {
      unanswered: location.unansweredReviews,
      last30Days: location.reviewsLast30,
      averageResponseHours: 31,
    },
    competitors: competitorRows,
    actions,
  };
}

export function demoAgencyDashboard(): AgencyDashboard {
  const clientNames = new Map<string, string>(DEMO_CLIENTS.map((c) => [c.id, c.name]));
  const portfolio: PortfolioRow[] = DEMO_LOCATIONS.map((location) => ({
    clientId: location.clientId,
    clientName: clientNames.get(location.clientId) ?? location.clientId,
    locationId: location.id,
    locationName: location.businessName.includes("—")
      ? location.businessName.split("—")[1]!.trim()
      : location.businessName,
    area: location.area,
    visibility: location.visibility,
    visibilityChange: location.visibilityChange,
    gbpHealth: location.gbpHealth,
    unansweredReviews: location.unansweredReviews,
    openIssues: Math.round(location.citationIssues / 4),
  }));

  const average = (values: number[]) =>
    Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);

  const declining = DEMO_LOCATIONS.filter((l) => l.visibilityChange < 0);
  const unanswered = DEMO_LOCATIONS.reduce((sum, l) => sum + l.unansweredReviews, 0);

  const actions: RecommendedAction[] = [
    {
      id: "act_declines",
      title: `${declining.length} locations declined in visibility`,
      reason: `${declining.map((l) => l.businessName.split("—").pop()!.trim()).join(", ")} dropped this period.`,
      severity: "critical",
      to: "/rankings/keywords",
      actionLabel: "Inspect rankings",
    },
    {
      id: "act_reviews",
      title: `${unanswered} unanswered reviews across the portfolio`,
      reason: "Concentrated in Hearth & Oak — Cherry Creek and Riverside Dental — South Congress.",
      severity: "attention",
      to: "/gbp/reviews",
      actionLabel: "Open Reviews",
    },
    {
      id: "act_citations",
      title: "Citation health below 60 on 3 locations",
      reason: "Round Rock, Cherry Creek and Lumen Family Law have unresolved NAP mismatches.",
      severity: "attention",
      to: "/citations",
      actionLabel: "Open Citations",
    },
  ];

  return {
    kind: "agency",
    comparisonLabel: "vs. previous 28 days",
    clientCount: DEMO_CLIENTS.length,
    locationCount: DEMO_LOCATIONS.length,
    averageVisibility: {
      label: "Average Visibility",
      value: average(DEMO_LOCATIONS.map((l) => l.visibility)),
      change: 2.1,
    },
    averageGbpHealth: {
      label: "Average GBP Health",
      value: average(DEMO_LOCATIONS.map((l) => l.gbpHealth)),
      change: -1.4,
    },
    attention: {
      decliningLocations: declining.length,
      unansweredReviews: unanswered,
      gbpIssues: DEMO_LOCATIONS.filter((l) => l.gbpHealth < 70).length * 3,
      reports: { ready: 4, scheduled: 6, failed: 1 },
    },
    portfolio,
    actions,
  };
}
