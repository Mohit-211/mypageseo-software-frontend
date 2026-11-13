/**
 * Extra detail for the dashboard when one location is in view (one location in the account, or
 * `?location=`): its daily profile views (GBP report), competitors and biggest keyword moves (Rank
 * Tracker). In the all-locations view these panels stay hidden, so every block shows one scope.
 */
import type { GbpRange, GbpReport, RankStatus, RankTrackerResponse } from "@/api";
import { formatShortDate } from "@/lib/datetime";
import { avgRankText } from "@/lib/rankings/format";
import { byNumber, byText, rankKey, sortRows } from "@/lib/sort";

/** The GBP report window that holds this period and the one before it (`by_day` is daily). */
export function reportRangeFor(days: number): GbpRange {
  return days * 2 <= 90 ? "90d" : "12m";
}

/* ----------------------------------------------------------------- daily series -- */

export type DailyMetric = "impressions" | "actions" | "calls" | "website_clicks" | "direction_requests";

export type DailyPoint = {
  /** Day 1…N of the period. */
  day: number;
  /** Axis label for the current period's date ("Oct 12"). */
  label: string;
  date: string;
  previousDate: string;
  current: number | null;
  previous: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-09-23" ± days, in UTC so time zones never shift a calendar date. */
function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * This period's days against the same days of the period before, aligned day by day (day 1 with
 * day 1). Null when the report has no daily performance.
 */
export function dailySeries(report: GbpReport | undefined, days: number, metric: DailyMetric): DailyPoint[] | null {
  const performance = report?.performance;
  if (!performance?.available || performance.by_day.length === 0) return null;
  const byDate = new Map<string, number | null>();
  for (const row of performance.by_day) byDate.set(row.date, row[metric] ?? null);
  // `by_day` isn't promised in either order: take the latest date it holds.
  const latest = performance.latest_date || [...byDate.keys()].sort().at(-1);
  if (!latest) return null;
  const points: DailyPoint[] = [];
  for (let index = 0; index < days; index += 1) {
    const date = shiftDate(latest, index - (days - 1));
    const previousDate = shiftDate(date, -days);
    points.push({
      day: index + 1,
      label: formatShortDate(date, ""),
      date,
      previousDate,
      current: byDate.get(date) ?? null,
      previous: byDate.get(previousDate) ?? null,
    });
  }
  return points.some((point) => point.current !== null) ? points : null;
}

/* ------------------------------------------------------------------ competitors -- */

export type CompetitorLine = {
  key: string;
  name: string;
  isYou: boolean;
  /** 1-based place among the rows with a rank; null without one. */
  position: number | null;
  rank: number | null;
  rankText: string;
  rankStatus: RankStatus | null;
  rating: number | null;
  reviews: number | null;
  photos: string | null;
};

/**
 * You and your tracked competitors, best average rank first ("60+" after every number, no data
 * last), with "You" kept in place. Ranks come from the Rank Tracker, ratings and photos from the
 * GBP report's public data.
 */
export function competitorLines(tracker: RankTrackerResponse | undefined, report: GbpReport | undefined, selfName: string): CompetitorLine[] {
  const facts = report?.competitors.available ? report.competitors.rows : [];
  const targets = tracker?.targets ?? [];
  if (targets.length < 2) return [];
  const rows = targets.map((target) => {
    const isYou = target.key === "self";
    const fact = facts.find((row) => row.place_id === target.place_id || (isYou && row.is_self));
    const overall = tracker?.overall[target.key];
    return {
      key: target.key,
      name: isYou ? selfName : (target.name ?? fact?.name ?? "Competitor"),
      isYou,
      position: null as number | null,
      rank: overall?.overallAvgRank ?? null,
      rankText: avgRankText(overall?.overallAvgRank, overall?.status, overall?.display),
      rankStatus: overall?.status ?? null,
      rating: fact?.rating ?? null,
      reviews: fact?.user_rating_count ?? null,
      photos: fact?.photo_count == null ? null : fact.photos_capped ? "10+" : String(fact.photo_count),
    };
  });
  const sorted = sortRows(
    rows,
    byNumber((row) => rankKey(row.rank, row.rankStatus)),
    byText((row) => (row.isYou ? "" : row.name)),
  );
  let place = 0;
  return sorted.map((row) => (rankKey(row.rank, row.rankStatus) === null ? row : { ...row, position: (place += 1) }));
}

/* -------------------------------------------------------------------- top movers -- */

export type KeywordMove = {
  keyword: string;
  /** Places gained (positive) or lost (negative); null for "new in the top 60" / "left the top 60". */
  change: number | null;
  /** Shown instead of a number when `change` is null. */
  note: string | null;
  rankText: string;
};

/** The keywords that moved most in the latest check: up to `limit` gains and `limit` losses. */
export function keywordMoves(tracker: RankTrackerResponse | undefined, limit = 3): { up: KeywordMove[]; down: KeywordMove[] } {
  const up: KeywordMove[] = [];
  const down: KeywordMove[] = [];
  for (const keyword of tracker?.keywords ?? []) {
    const self = keyword.summary.self;
    if (!self) continue;
    const rankText = avgRankText(self.avgRank, self.status, self.display);
    // `change` is previous − current: positive means the keyword moved up.
    const change = typeof self.change === "number" && Number.isFinite(self.change) ? self.change : null;
    if (change !== null && change > 0) up.push({ keyword: keyword.keyword, change, note: null, rankText });
    else if (change !== null && change < 0) down.push({ keyword: keyword.keyword, change, note: null, rankText });
    else if (self.changeLabel === "entered_top_60") up.push({ keyword: keyword.keyword, change: null, note: "New in top 60", rankText });
    else if (self.changeLabel === "dropped_out_of_top_60") down.push({ keyword: keyword.keyword, change: null, note: "Left the top 60", rankText });
  }
  return {
    up: sortRows(up, byNumber((move) => (move.change === null ? 100 : move.change), "desc"), byText((move) => move.keyword)).slice(0, limit),
    down: sortRows(down, byNumber((move) => (move.change === null ? -100 : move.change)), byText((move) => move.keyword)).slice(0, limit),
  };
}
