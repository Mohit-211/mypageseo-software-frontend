import {
  AI_PLATFORM_LABEL,
  TOPIC_LABEL,
  type PlatformFilter,
  type PromptCheck,
  type TopicId,
} from "@/lib/ai-visibility/ai-visibility";

export type MentionFilter = "all" | "mentioned" | "not_mentioned";
export type PositionFilter = "all" | "top3" | "4plus" | "none";
export type VisibilityFilter = "all" | "high" | "medium" | "low";
export type CheckedFilter = "all" | "24h" | "7d" | "30d";

export type PromptFilterState = {
  search: string;
  platform: PlatformFilter;
  mention: MentionFilter;
  position: PositionFilter;
  visibility: VisibilityFilter;
  checked: CheckedFilter;
  topic: TopicId | "all";
};

export const DEFAULT_PROMPT_FILTERS: PromptFilterState = {
  search: "",
  platform: "all",
  mention: "all",
  position: "all",
  visibility: "all",
  checked: "all",
  topic: "all",
};

export const MENTION_LABEL: Record<MentionFilter, string> = { all: "Any mention", mentioned: "Mentioned", not_mentioned: "Not mentioned" };
export const POSITION_LABEL: Record<PositionFilter, string> = { all: "Any position", top3: "Position 1–3", "4plus": "Position 4+", none: "No position" };
export const VISIBILITY_LABEL: Record<VisibilityFilter, string> = { all: "Any visibility", high: "75% and above", medium: "50–74%", low: "Below 50%" };
export const CHECKED_LABEL: Record<CheckedFilter, string> = { all: "Any date", "24h": "Last 24 hours", "7d": "Last 7 days", "30d": "Last 30 days" };

const CHECKED_HOURS: Record<Exclude<CheckedFilter, "all">, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

/** Applies every filter except the free-text search, which also needs prompt text. */
export function matchesPromptFilters(check: PromptCheck, topic: TopicId, filters: PromptFilterState, now = Date.now()): boolean {
  if (filters.platform !== "all" && check.platform !== filters.platform) return false;
  if (filters.topic !== "all" && topic !== filters.topic) return false;
  if (filters.mention === "mentioned" && check.mentioned !== true) return false;
  if (filters.mention === "not_mentioned" && check.mentioned !== false) return false;
  if (filters.position === "top3" && !(check.position !== null && check.position <= 3)) return false;
  if (filters.position === "4plus" && !(check.position !== null && check.position >= 4)) return false;
  if (filters.position === "none" && check.position !== null) return false;
  const v = check.visibility;
  if (filters.visibility === "high" && !(v !== null && v >= 75)) return false;
  if (filters.visibility === "medium" && !(v !== null && v >= 50 && v < 75)) return false;
  if (filters.visibility === "low" && !(v !== null && v < 50)) return false;
  if (filters.checked !== "all") {
    if (!check.checkedAt) return false;
    if (now - new Date(check.checkedAt).getTime() > CHECKED_HOURS[filters.checked] * 3_600_000) return false;
  }
  return true;
}

export function activeFilterChips(filters: PromptFilterState) {
  const chips: { label: string; value: string }[] = [];
  if (filters.topic !== "all") chips.push({ label: "Topic", value: TOPIC_LABEL[filters.topic] });
  if (filters.platform !== "all") chips.push({ label: "Platform", value: AI_PLATFORM_LABEL[filters.platform] });
  if (filters.mention !== "all") chips.push({ label: "Mention", value: MENTION_LABEL[filters.mention] });
  if (filters.position !== "all") chips.push({ label: "Position", value: POSITION_LABEL[filters.position] });
  if (filters.visibility !== "all") chips.push({ label: "Visibility", value: VISIBILITY_LABEL[filters.visibility] });
  if (filters.checked !== "all") chips.push({ label: "Last checked", value: CHECKED_LABEL[filters.checked] });
  return chips;
}
