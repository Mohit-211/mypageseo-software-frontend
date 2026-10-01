import type { ChangeLabel, RankBucket } from "@/api";

/**
 * Targets carry only a key and a place id, so competitors are labelled by their
 * slot ("Competitor 1"). `selfName` labels the location itself.
 */
export function targetLabel(key: string, selfName = "Your business"): string {
  if (key === "self") return selfName;
  const match = /^competitor_(\d+)$/.exec(key);
  return match ? `Competitor ${match[1]}` : key;
}

export function formatAvgRank(value: number | null | undefined): string {
  return value == null ? "—" : value.toFixed(1);
}

/** 0–1 → "40%". */
export function formatRate(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

export function formatRunDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export const CHANGE_LABEL_TEXT: Record<ChangeLabel, string> = {
  improved: "Improved",
  declined: "Declined",
  unchanged: "Unchanged",
  entered_top_60: "Entered top 60",
  dropped_out_of_top_60: "Dropped out of top 60",
};

export const BUCKET_LABEL: Record<RankBucket, string> = {
  pack: "1–3 (map pack)",
  visible: "4–10",
  low: "11–20",
  invisible: "21–60",
  not_found: "Not in top 60",
  error: "Search failed",
};
