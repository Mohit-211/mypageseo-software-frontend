/**
 * Plain-language explanations for ranking terms, shown in tooltips.
 * One place so the pages, dialogs and tables say the same thing.
 */
import type { TrackerPointLabel } from "@/api";

const DIRECTION: Record<Exclude<TrackerPointLabel, "C">, string> = { N: "north", S: "south", E: "east", W: "west" };

/** Tooltip for a tracker point column (C, N, S, E, W). */
export function pointExplanation(point: TrackerPointLabel, offsetKm?: number): string {
  if (point === "C") return "Center: a search made right at the business center, as if a customer were standing there.";
  const distance = offsetKm ? `${offsetKm} km` : "a set distance";
  return `${DIRECTION[point][0]!.toUpperCase()}${DIRECTION[point].slice(1)}: a search made ${distance} ${DIRECTION[point]} of the business center, as if a customer were searching from there.`;
}

export const GLOSSARY = {
  trackerPoints:
    "Google shows different results depending on where the searcher is. We search each keyword from 5 spots: the center (C) and points to the north, south, east and west (N, S, E, W).",
  avgRank:
    "The business's average position in Google Maps results. 1 is the top result; lower is better. If it isn't in the top 60, that spot counts as 61.",
  found: "The share of searches where the business appears anywhere in the top 60 results.",
  top3: "The share of searches where the business is in the top 3, the “map pack” Google shows first.",
  change: "Compared with the previous ranking run. A green up arrow means the business moved up (better).",
  businessCenter:
    "Rankings are measured around the business center: the business's own pin on Google Maps, or, for a service-area business without a public address, the city or ZIP set during setup.",
  gridSize:
    "How many search points the grid has. 7 × 7 means 49 points in a square around the business; more points give a finer picture of where it ranks.",
  gridRadius:
    "How far the grid reaches from the business center to its edge in every direction. 8 km (about 5 miles) covers a typical service area.",
  searchesPerKeyword: "Each point is one search per keyword; more points mean more searches and a longer run.",
  runTime: "How long a full ranking run takes with these settings. Runs happen in the background.",
  tokenCost: "Pressing Refresh rankings costs this many tokens. The automatic monthly refresh is free.",
  distribution: "How the business ranks across all searches of this run, grouped by position range.",
  movers: "The keywords whose average rank changed the most since the previous run.",
  mapPoint: "Where the search is made from. The top 20 can differ between the center and the points around it.",
} as const;
