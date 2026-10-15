import type { CSSProperties } from "react";

/** Rank buckets and their key-cap colours (the same families as the app's rank colours). */
export type RankBucket = "pack" | "visible" | "low" | "invisible" | "not_found" | "error";

export function rankBucket(rank: number | null, status: "ok" | "not_found" | "error" = "ok"): RankBucket {
  if (status === "error") return "error";
  if (status === "not_found" || rank === null || rank > 60) return "not_found";
  if (rank <= 3) return "pack";
  if (rank <= 10) return "visible";
  if (rank <= 20) return "low";
  return "invisible";
}

export const BUCKET_TEXT: Record<RankBucket, string> = {
  pack: "Top 3",
  visible: "4–10",
  low: "11–20",
  invisible: "21–60",
  not_found: "Not in top 60",
  error: "No result",
};

export const BUCKET_CAP: Record<RankBucket, { fill: string; lip: string; text: string }> = {
  pack: { fill: "var(--success)", lip: "color-mix(in oklch, var(--success) 70%, black)", text: "#fff" },
  visible: { fill: "var(--info)", lip: "color-mix(in oklch, var(--info) 70%, black)", text: "#fff" },
  low: { fill: "var(--warning)", lip: "color-mix(in oklch, var(--warning) 70%, black)", text: "var(--warning-foreground)" },
  invisible: { fill: "var(--critical)", lip: "color-mix(in oklch, var(--critical) 70%, black)", text: "#fff" },
  not_found: { fill: "color-mix(in oklch, var(--muted-foreground) 55%, white)", lip: "color-mix(in oklch, var(--muted-foreground) 80%, black)", text: "#fff" },
  error: { fill: "var(--surface-strong)", lip: "var(--border)", text: "var(--muted-foreground)" },
};

export function capStyle(bucket: RankBucket): CSSProperties {
  const cap = BUCKET_CAP[bucket];
  return {
    background: `linear-gradient(180deg, color-mix(in oklch, ${cap.fill} 82%, white), ${cap.fill})`,
    color: cap.text,
    ["--cap-lip" as string]: cap.lip,
  };
}

