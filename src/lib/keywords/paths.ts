/**
 * Links to and from the Keywords page. Every link from keyword screens to the AI and ranking pages
 * goes through here, so a route change is a one-file edit.
 */
import { locationPath } from "@/lib/mypageseo/section-links";

/** Sort keys of the keyword table (`?sort=`). */
export type KeywordSortKey = "priority" | "keyword" | "rank" | "change" | "top3" | "searches";

export const KEYWORD_SORT_KEYS: readonly KeywordSortKey[] = ["priority", "keyword", "rank", "change", "top3", "searches"];

/** Section anchors on the Keywords page. */
export type KeywordsSection = "groups" | "searches";

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** `/locations/:id/keywords`, optionally opening one keyword (`?keyword=`), a group filter, a sort or a section. */
export function keywordsPath(
  locationId: string,
  options: { keyword?: string; group?: string; sort?: KeywordSortKey; section?: KeywordsSection } = {},
): string {
  const hash = options.section ? `#${options.section}` : "";
  return locationPath(locationId, "keywords", `${query({ keyword: options.keyword, group: options.group, sort: options.sort })}${hash}`);
}

/**
 * AI Posts. With a keyword ("Write a post with it"), the writer starts on it (`?keyword=`) and the
 * page opens at the writer (`#ideas`) instead of the top.
 */
export function aiPostsPath(locationId: string, keyword?: string): string {
  return locationPath(locationId, "ai/posts", `${query({ keyword })}${keyword ? "#ideas" : ""}`);
}

export function aiRepliesPath(locationId: string): string {
  return locationPath(locationId, "ai/replies");
}

/** A ranking page for one keyword or group (the pages read `?keyword=` and `?group=`). */
export function rankingsPagePath(
  locationId: string,
  page: "rankings" | "rankings/tracker" | "rankings/map" | "rankings/grid" | "competitors",
  options: { keyword?: string; group?: string } = {},
): string {
  return locationPath(locationId, page, query({ keyword: options.keyword, group: options.group }));
}
