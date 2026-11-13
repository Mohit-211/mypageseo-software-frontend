/**
 * Rank bands for whole keywords (the business's average rank in the latest run), for the Keywords
 * page's health bar, legend, filters and rank pills. The colours are the rank bucket colours of the
 * Rank Tracker cells, so a keyword reads the same everywhere; a band is always shown with its label.
 */
import type { ChangeLabel, RankSummary } from "@/api";
import { BUCKET_CLASS } from "@/lib/rankings/format";

export type KeywordBand = "pack" | "visible" | "low" | "invisible" | "not_found" | "no_data" | "pending";

/** Best to worst, then the two "nothing to show yet" bands. */
export const BAND_ORDER: readonly KeywordBand[] = ["pack", "visible", "low", "invisible", "not_found", "no_data", "pending"];

export const BAND_LABEL: Record<KeywordBand, string> = {
  pack: "Top 3",
  visible: "4–10",
  low: "11–20",
  invisible: "21–60",
  not_found: "Not in top 60",
  no_data: "No data",
  pending: "Next run",
};

/** What each band means, for tooltips and screen readers. */
export const BAND_DESCRIPTION: Record<KeywordBand, string> = {
  pack: "On average in Google Maps' top 3, the map pack people see first.",
  visible: "On average in positions 4 to 10: on the first screen of results.",
  low: "On average in positions 11 to 20: people have to scroll to find you.",
  invisible: "On average below position 20: rarely seen.",
  not_found: "Not in Google's top 60 at any of the search spots.",
  no_data: "Google's searches failed for this keyword in the last run. It's measured again next run.",
  pending: "Added after the last run. It's measured from the next ranking run.",
};

/** Solid fills for the health bar and legend dots (graphics: each is >= 3:1 on white, except "no data"/"next run", which always carry a label). */
export const BAND_FILL: Record<KeywordBand, string> = {
  pack: "bg-success",
  visible: "bg-info",
  low: "bg-warning",
  invisible: "bg-critical",
  not_found: "bg-input",
  no_data: "bg-border-strong",
  pending: "bg-info/30",
};

/** Soft pills for a keyword's rank value (the Rank Tracker cell colours). */
export const BAND_PILL: Record<KeywordBand, string> = {
  pack: BUCKET_CLASS.pack,
  visible: BUCKET_CLASS.visible,
  low: BUCKET_CLASS.low,
  invisible: BUCKET_CLASS.invisible,
  not_found: BUCKET_CLASS.not_found,
  no_data: "border-dashed border-border-strong bg-card text-muted-foreground",
  pending: "border-dashed border-info/40 bg-info-surface text-info",
};

/** The band of one keyword: its average in the latest run, or "next run" when that run didn't have it. */
export function bandFor(summary: RankSummary | null | undefined, measured: boolean): KeywordBand {
  if (!measured) return "pending";
  if (!summary || summary.status === "no_data") return "no_data";
  if (summary.status === "not_found") return "not_found";
  const value = summary.avgRank;
  if (value == null) return "no_data";
  if (value <= 3) return "pack";
  if (value <= 10) return "visible";
  if (value <= 20) return "low";
  return "invisible";
}

export type Movement = "improved" | "declined" | "unchanged" | "new";

/** How a keyword moved since the previous run ("entered the top 60" counts as improved). */
export function movementOf(summary: Pick<RankSummary, "change" | "changeLabel"> | null | undefined): Movement {
  const label: ChangeLabel | null | undefined = summary?.changeLabel;
  if (label === "improved" || label === "entered_top_60") return "improved";
  if (label === "declined" || label === "dropped_out_of_top_60") return "declined";
  if (label === "unchanged") return "unchanged";
  const change = summary?.change;
  if (change == null) return "new";
  return change > 0 ? "improved" : change < 0 ? "declined" : "unchanged";
}

export type KeywordHealth = {
  total: number;
  counts: Record<KeywordBand, number>;
  /** Measured keywords by movement since the previous run. */
  movement: Record<Movement, number>;
  /** Keywords the latest run measured. */
  measured: number;
};

/** Counts for the health bar. */
export function summarizeHealth(rows: readonly { band: KeywordBand; measured: boolean; self: RankSummary | null }[]): KeywordHealth {
  const counts = Object.fromEntries(BAND_ORDER.map((band) => [band, 0])) as Record<KeywordBand, number>;
  const movement: Record<Movement, number> = { improved: 0, declined: 0, unchanged: 0, new: 0 };
  let measured = 0;
  for (const row of rows) {
    counts[row.band] += 1;
    if (!row.measured) continue;
    measured += 1;
    movement[movementOf(row.self)] += 1;
  }
  return { total: rows.length, counts, movement, measured };
}
