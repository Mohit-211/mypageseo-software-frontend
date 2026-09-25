/**
 * Demo ranking datasets for the Rankings workspace (overview, keywords, groups,
 * map rankings, local search grid, competitor comparisons). Everything is
 * derived from the canonical facts in `entities.ts` so numbers stay mutually
 * consistent with the rest of the demo account.
 */
import { demoDate, pickInt, seedFrom } from "./demo-mode";
import {
  demoCompetitors,
  demoKeywords,
  demoLocation,
  type DemoKeyword,
} from "./entities";
import type {
  RankingBucket,
  RankingHistoryPoint,
  RankingKeywordRow,
  RankingMovement,
  RankingOverviewData,
} from "../../raking-lib/ranking-overview";
import type { KeywordRankingRow, KeywordRankingsData } from "../keyword-rankings";
import type { KeywordGroupRow, KeywordGroupsData } from "../keyword-groups";
import type {
  MapRankingData,
  MapRankingKeyword,
  MapRankingPoint,
  MapRankingResult,
  MapSearchContext,
} from "../map-rankings";
import type { GridDistributionBucket, GridPoint, LocalSearchGridData } from "../local-search-grid";
import type {
  CompetitorPosition,
  CompetitorRankingRow,
  CompetitorRankingsData,
  CompetitorTrendPoint,
} from "../competitor-rankings";

function movementOf(previous: number | null, current: number | null): number | null {
  if (previous === null || current === null) return null;
  return previous - current;
}

function movementStatus(movement: number | null): RankingMovement {
  if (movement === null || movement === 0) return "unchanged";
  return movement > 0 ? "improved" : "declined";
}

function toKeywordRow(keyword: DemoKeyword): RankingKeywordRow {
  const movement = movementOf(keyword.previousPosition, keyword.currentPosition);
  return {
    id: keyword.id,
    keyword: keyword.keyword,
    previousPosition: keyword.previousPosition,
    currentPosition: keyword.currentPosition,
    movement,
    resultType: keyword.resultType,
  };
}

/** Ranking overview: summary metrics, 12-point history, distribution, movers. */
export function demoRankingOverview(locationId?: string | null): RankingOverviewData {
  const location = demoLocation(locationId);
  const keywords = demoKeywords(location.id);
  const ranked = keywords.filter((k) => k.currentPosition !== null);
  const withComparison = ranked.filter((k) => k.previousPosition !== null);

  const avgCurrent = ranked.reduce((sum, k) => sum + (k.currentPosition ?? 0), 0) / Math.max(1, ranked.length);
  const avgPrevious = withComparison.reduce((sum, k) => sum + (k.previousPosition ?? 0), 0) / Math.max(1, withComparison.length);

  const improved = withComparison.filter((k) => (k.previousPosition ?? 0) > (k.currentPosition ?? 0)).length;
  const declined = withComparison.filter((k) => (k.previousPosition ?? 0) < (k.currentPosition ?? 0)).length;
  const positionalMovement = withComparison.reduce((sum, k) => sum + ((k.previousPosition ?? 0) - (k.currentPosition ?? 0)), 0);

  const history: RankingHistoryPoint[] = Array.from({ length: 12 }).map((_, index) => {
    const daysAgo = (11 - index) * 14;
    const seed = seedFrom(location.id, "history", index);
    const drift = pickInt(seed, -2, 2) / 2;
    const trendFraction = index / 11;
    const averagePosition = Number((avgPrevious + (avgCurrent - avgPrevious) * trendFraction + drift).toFixed(1));
    const comparisonPosition = index >= 1 ? Number((averagePosition + pickInt(seed + 3, 1, 3)).toFixed(1)) : null;
    return { date: demoDate(daysAgo), averagePosition: Math.max(1, averagePosition), comparisonPosition };
  });

  const buckets: RankingBucket[] = [
    { label: "1–3", count: keywords.filter((k) => k.currentPosition !== null && k.currentPosition <= 3).length },
    { label: "4–10", count: keywords.filter((k) => k.currentPosition !== null && k.currentPosition > 3 && k.currentPosition <= 10).length },
    { label: "11–20", count: keywords.filter((k) => k.currentPosition !== null && k.currentPosition > 10 && k.currentPosition <= 20).length },
    { label: "21–50", count: keywords.filter((k) => k.currentPosition !== null && k.currentPosition > 20).length },
    { label: "Unranked", count: keywords.filter((k) => k.currentPosition === null).length },
  ];

  const rows = keywords.map(toKeywordRow);
  const topMovers = [...rows]
    .filter((row) => row.movement !== null && row.movement !== 0)
    .sort((a, b) => Math.abs(b.movement ?? 0) - Math.abs(a.movement ?? 0))
    .slice(0, 5);

  const localFinderKeywords = keywords.filter((k) => k.resultType === "local_finder");
  const localPackHits = localFinderKeywords.filter((k) => k.currentPosition !== null && k.currentPosition <= 3).length;
  const localPackCoverage = localFinderKeywords.length
    ? Math.round((localPackHits / localFinderKeywords.length) * 100)
    : location.localPackCoverage;

  return {
    status: "ready",
    comparisonLabel: "Previous 30 days",
    metrics: {
      averageGooglePosition: { value: Number(avgCurrent.toFixed(1)), change: Number((avgCurrent - avgPrevious).toFixed(1)) },
      keywordMovement: { value: improved, change: improved - declined },
      positionalMovement: { value: positionalMovement, change: null },
      localPackCoverage: { value: localPackCoverage, change: Number((location.visibilityChange / 4).toFixed(1)) },
    },
    history,
    distribution: buckets,
    topMovers,
    snapshot: rows.slice(0, 8),
  };
}

/** Full tracked keyword table used by the Keywords screen. */
export function demoKeywordRankings(locationId?: string | null): KeywordRankingsData {
  const location = demoLocation(locationId);
  const keywords = demoKeywords(location.id);
  const rows: KeywordRankingRow[] = keywords.map((keyword) => {
    const movement = movementOf(keyword.previousPosition, keyword.currentPosition);
    return {
      id: keyword.id,
      keyword: keyword.keyword,
      group: keyword.group,
      resultType: keyword.resultType,
      currentPosition: keyword.currentPosition,
      previousPosition: keyword.previousPosition,
      movement,
      movementStatus: movementStatus(movement),
      comparisonAvailable: keyword.previousPosition !== null,
    };
  });
  const groups = Array.from(new Set(keywords.map((k) => k.group)));
  return {
    status: "ready",
    comparisonLabel: "Previous 30 days",
    groups,
    rows,
    total: rows.length,
  };
}

/** Keyword groups rolled up from tracked keywords for this location. */
export function demoKeywordGroups(locationId?: string | null): KeywordGroupsData {
  const location = demoLocation(locationId);
  const keywords = demoKeywords(location.id);
  const groupNames = Array.from(new Set(keywords.map((k) => k.group)));
  const rows: KeywordGroupRow[] = groupNames.map((name, index) => {
    const groupKeywords = keywords.filter((k) => k.group === name);
    const ranked = groupKeywords.filter((k) => k.currentPosition !== null);
    const withComparison = groupKeywords.filter((k) => k.currentPosition !== null && k.previousPosition !== null);
    const averagePosition = ranked.length
      ? Number((ranked.reduce((sum, k) => sum + (k.currentPosition ?? 0), 0) / ranked.length).toFixed(1))
      : null;
    const localFinder = groupKeywords.filter((k) => k.resultType === "local_finder");
    const localPackCoverage = localFinder.length
      ? Math.round((localFinder.filter((k) => k.currentPosition !== null && k.currentPosition <= 3).length / localFinder.length) * 100)
      : null;
    const movement = withComparison.length
      ? Math.round(withComparison.reduce((sum, k) => sum + ((k.previousPosition ?? 0) - (k.currentPosition ?? 0)), 0) / withComparison.length)
      : null;
    return {
      id: `${location.id}_group_${index + 1}`,
      name,
      keywordCount: groupKeywords.length,
      averagePosition,
      localPackCoverage,
      movement,
      movementStatus: movement === null ? "unavailable" : movement === 0 ? "unchanged" : movement > 0 ? "improved" : "declined",
      updatedAt: demoDate(1),
    };
  });
  return { status: "ready", rows, total: rows.length };
}

/** Named geographic search points near the demo location, used by map/grid screens. */
export function demoSearchContexts(locationId?: string | null): MapSearchContext[] {
  const location = demoLocation(locationId);
  const labels = ["Downtown", "North side", "East side", "South side", "West side"];
  return labels.map((label, index) => {
    const seed = seedFrom(location.id, "context", label);
    return {
      id: `ctx_${location.id}_${index + 1}`,
      label: `${label} (${location.area})`,
      latitude: Number((30.2672 + pickInt(seed, -60, 60) / 1000).toFixed(5)),
      longitude: Number((-97.7431 + pickInt(seed + 5, -60, 60) / 1000).toFixed(5)),
    };
  });
}

/** Geographic Map Rankings data for a single keyword/search-context combination. */
export function demoMapRankings(locationId?: string | null): MapRankingData {
  const location = demoLocation(locationId);
  const keywords = demoKeywords(location.id).filter((k) => k.currentPosition !== null);
  const mapKeywords: MapRankingKeyword[] = keywords.map((k) => ({ id: k.id, label: k.keyword }));
  const searchContexts = demoSearchContexts(location.id);
  const dates = [demoDate(1), demoDate(15), demoDate(30)];
  const comparisonDates = [demoDate(15), demoDate(30), demoDate(45)];
  const selectedKeyword = mapKeywords[0] ?? null;
  const keywordFact = keywords[0];
  const selectedSearchContext = searchContexts[0] ?? null;
  const competitors = demoCompetitors(location.id);

  const points: MapRankingPoint[] = searchContexts.map((context, index) => {
    const seed = seedFrom(location.id, "map-point", context.id);
    const rank = Math.max(1, Math.round((keywordFact?.currentPosition ?? location.averageRank) + pickInt(seed, -2, 4)));
    const previousRank = Math.max(1, rank + pickInt(seed + 3, -2, 3));
    return {
      id: `pt_${context.id}`,
      latitude: context.latitude,
      longitude: context.longitude,
      rank: rank > 20 ? null : rank,
      previousRank: previousRank > 20 ? null : previousRank,
      isSelectedBusiness: index === 0,
    };
  });

  const currentRank = points[0]?.rank ?? null;
  const previousRank = points[0]?.previousRank ?? null;

  const results: MapRankingResult[] = [
    { id: `res_${location.id}_self`, businessName: location.businessName, position: currentRank ?? 20, previousPosition: previousRank, isSelectedBusiness: true },
    ...competitors.map((competitor, index) => {
      const seed = seedFrom(location.id, "map-result", competitor.id);
      const position = Math.max(1, Math.round(competitor.averageRank + pickInt(seed, -2, 2)));
      const previousPosition = Math.max(1, position + pickInt(seed + 7, -2, 2));
      return { id: `res_${competitor.id}`, businessName: competitor.name, position, previousPosition, isSelectedBusiness: false };
    }),
  ].sort((a, b) => a.position - b.position);

  return {
    status: "ready",
    keywords: mapKeywords,
    searchContexts,
    dates,
    comparisonDates,
    resultTypes: ["google_maps", "local_finder"],
    selectedKeyword,
    selectedSearchContext,
    selectedDate: dates[0] ?? null,
    comparisonDate: comparisonDates[0] ?? null,
    resultType: "google_maps",
    currentRank,
    previousRank,
    points,
    results,
  };
}

/** 7x7 local search grid centered on the location, reflecting its average rank. */
export function demoLocalSearchGrid(locationId?: string | null): LocalSearchGridData {
  const location = demoLocation(locationId);
  const keywords = demoKeywords(location.id).filter((k) => k.currentPosition !== null);
  const gridKeywords = keywords.map((k) => ({ id: k.id, label: k.keyword }));
  const selectedKeyword = gridKeywords[0] ?? null;
  const keywordFact = keywords[0];
  const rows = 7;
  const columns = 7;
  const centerRow = (rows - 1) / 2;
  const centerColumn = (columns - 1) / 2;
  const baseRank = keywordFact?.currentPosition ?? location.averageRank;

  const points: GridPoint[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const seed = seedFrom(location.id, "grid", row, column);
      const distance = Math.hypot(row - centerRow, column - centerColumn);
      const rawRank = Math.round(baseRank + distance * 1.6 + pickInt(seed, -2, 2));
      const rank = rawRank > 22 ? null : Math.max(1, rawRank);
      const previousRaw = rank === null ? null : rank + pickInt(seed + 11, -2, 2);
      points.push({
        id: `grid_${row}_${column}`,
        row,
        column,
        latitude: Number((30.2672 + (row - centerRow) * 0.01).toFixed(5)),
        longitude: Number((-97.7431 + (column - centerColumn) * 0.01).toFixed(5)),
        rank,
        previousRank: previousRaw === null ? null : Math.max(1, previousRaw),
      });
    }
  }

  const rankedPoints = points.filter((p) => p.rank !== null);
  const averageRank = rankedPoints.length
    ? rankedPoints.reduce((sum, p) => sum + (p.rank ?? 0), 0) / rankedPoints.length
    : location.averageRank;
  const visiblePoints = points.filter((p) => p.rank !== null && p.rank <= 10).length;
  const coveragePoints = points.filter((p) => p.rank !== null && p.rank <= 3).length;

  const distribution: GridDistributionBucket[] = [
    { label: "1–3 (strong)", range: "strong", count: points.filter((p) => p.rank !== null && p.rank <= 3).length },
    { label: "4–10 (visible)", range: "visible", count: points.filter((p) => p.rank !== null && p.rank > 3 && p.rank <= 10).length },
    { label: "11+ (weak)", range: "weak", count: points.filter((p) => p.rank !== null && p.rank > 10).length },
    { label: "Not ranked", range: "unranked", count: points.filter((p) => p.rank === null).length },
  ];

  return {
    status: "ready",
    keywords: gridKeywords,
    gridSizes: ["5x5", "7x7", "9x9"],
    radii: ["1 mi", "3 mi", "5 mi"],
    searchTypes: ["google_maps", "local_finder"],
    scanDates: [demoDate(1), demoDate(15), demoDate(30)],
    comparisonDates: [demoDate(15), demoDate(30), demoDate(45)],
    selectedKeyword,
    gridSize: "7x7",
    radius: "3 mi",
    searchType: "google_maps",
    scanDate: demoDate(1),
    comparisonDate: demoDate(15),
    geographicContext: location.area,
    rows,
    columns,
    points,
    metrics: {
      averageRank: { value: Number(averageRank.toFixed(1)), change: Number((location.averageRankChange).toFixed(1)) },
      visibility: { value: Math.round((visiblePoints / points.length) * 100), change: Number((location.visibilityChange / 2).toFixed(1)) },
      coverage: { value: Math.round((coveragePoints / points.length) * 100), change: Number((location.visibilityChange / 3).toFixed(1)) },
    },
    distribution,
  };
}

/** Keyword-by-keyword comparison of the location against its tracked competitors. */
export function demoCompetitorRankings(locationId?: string | null): CompetitorRankingsData {
  const location = demoLocation(locationId);
  const keywords = demoKeywords(location.id);
  const competitors = demoCompetitors(location.id);
  const trackedCompetitors = competitors.map((c) => ({ id: c.id, name: c.name }));
  const groups = Array.from(new Set(keywords.map((k) => k.group)));

  const rows: CompetitorRankingRow[] = keywords.map((keyword) => {
    const locationMovement = movementOf(keyword.previousPosition, keyword.currentPosition);
    const competitorPositions: CompetitorPosition[] = competitors.map((competitor) => {
      const seed = seedFrom(location.id, keyword.id, competitor.id);
      const raw = Math.round(competitor.averageRank + pickInt(seed, -6, 8));
      const currentPosition = raw < 1 ? 1 : raw > 40 ? null : raw;
      const previousRaw = currentPosition === null ? null : currentPosition + pickInt(seed + 5, -3, 3);
      const previousPosition = previousRaw === null ? null : Math.max(1, previousRaw);
      const movement = movementOf(previousPosition, currentPosition);
      return { competitorId: competitor.id, currentPosition, previousPosition, movement, movementStatus: movementStatus(movement) };
    });
    return {
      id: keyword.id,
      keyword: keyword.keyword,
      group: keyword.group,
      resultType: keyword.resultType,
      locationPosition: keyword.currentPosition,
      locationPreviousPosition: keyword.previousPosition,
      locationMovement,
      locationMovementStatus: movementStatus(locationMovement),
      competitorPositions,
    };
  });

  const trend: CompetitorTrendPoint[] = Array.from({ length: 6 }).map((_, index) => {
    const daysAgo = (5 - index) * 20;
    const seed = seedFrom(location.id, "competitor-trend", index);
    const locationPosition = Math.max(1, Math.round(location.averageRank + pickInt(seed, -3, 3)));
    const competitorPositions: Record<string, number | null> = {};
    competitors.forEach((competitor) => {
      const compSeed = seedFrom(location.id, "competitor-trend", index, competitor.id);
      competitorPositions[competitor.id] = Math.max(1, Math.round(competitor.averageRank + pickInt(compSeed, -3, 3)));
    });
    return { date: demoDate(daysAgo), locationPosition, competitorPositions };
  });

  return {
    status: "ready",
    locationName: location.businessName,
    competitors: trackedCompetitors,
    groups,
    dates: [demoDate(1), demoDate(15), demoDate(30)],
    comparisonPeriods: ["Previous 30 days", "Previous 90 days"],
    resultTypes: ["google", "local_finder"],
    comparisonAvailable: true,
    rows,
    trend,
    total: rows.length,
  };
}
