/**
 * Location-scoped addresses. Every module that works on one location (keywords, rankings,
 * GBP, reputation, citations, competitors, AI) lives under `/locations/:locationId/…`.
 * Links that know the location go there directly, so a click never passes through a
 * redirect page (the cause of the blank flash between pages).
 */

/** Each location page, as the path after `/locations/:locationId`. */
export const LOCATION_SECTIONS = {
  overview: "",
  keywords: "keywords",
  rankings: "rankings",
  "rankings/tracker": "rankings/tracker",
  "rankings/map": "rankings/map",
  "rankings/grid": "rankings/grid",
  competitors: "rankings/competitors",
  gbp: "gbp",
  "gbp/audit": "gbp/audit",
  "gbp/comparison": "gbp/audit/competitors",
  "gbp/posts": "gbp/posts",
  reputation: "reputation",
  "reputation/insights": "reputation/insights",
  citations: "citations",
  ai: "ai",
  "ai/posts": "ai/posts",
  "ai/replies": "ai/replies",
  /**
   * Sections: `#replies`, `#restricted`, `#facts` (Facts for the AI), `#images`; Phase 25b/25c: `#logo`, `#style`
   * (the style memo) and `#auto-replies` (the automatic replies card).
   */
  "ai/settings": "ai/settings",
  /** Phase 25b: the business brief (linked from AI Settings and the readiness checklist). */
  "ai/brief": "ai/brief",
  /** Phase 25c: the photo library (linked from AI Settings, readiness and the post editor). */
  "ai/photos": "ai/photos",
} as const;

export type LocationSection = keyof typeof LOCATION_SECTIONS;

/** The page name of each location section (as the sidebar and page headers name it). */
export const LOCATION_SECTION_LABELS: Record<LocationSection, string> = {
  overview: "Overview",
  keywords: "Keywords",
  rankings: "Rank Overview",
  "rankings/tracker": "Rank Tracker",
  "rankings/map": "Map Rankings",
  "rankings/grid": "Local Search Grid",
  competitors: "Competitors",
  gbp: "GBP Overview",
  "gbp/audit": "GBP Audit",
  "gbp/comparison": "Profile Comparison",
  "gbp/posts": "Posts",
  reputation: "Reviews",
  "reputation/insights": "Review Insights",
  citations: "Citations",
  ai: "AI Studio",
  "ai/posts": "AI Posts",
  "ai/replies": "AI Review Replies",
  "ai/settings": "AI Settings",
  "ai/brief": "Business brief",
  "ai/photos": "Photo library",
};

/** `/locations/:id/<section>` plus an optional `?search` / `#hash` suffix. */
export function locationPath(locationId: string, section: LocationSection = "overview", suffix = ""): string {
  const tail = LOCATION_SECTIONS[section];
  return `/locations/${encodeURIComponent(locationId)}${tail ? `/${tail}` : ""}${suffix}`;
}

/**
 * The location that location-scoped links point at: the one in the URL, else the one the
 * user picked last (if it still exists), else the first location. Null without locations.
 */
export function pickNavLocationId(input: {
  routeLocationId?: string | null | undefined;
  activeLocationId?: string | null | undefined;
  locationIds: readonly string[];
}): string | null {
  const { routeLocationId, activeLocationId, locationIds } = input;
  if (routeLocationId && routeLocationId !== "add" && locationIds.includes(routeLocationId)) return routeLocationId;
  if (activeLocationId && locationIds.includes(activeLocationId)) return activeLocationId;
  return locationIds[0] ?? null;
}

/**
 * Older portfolio addresses (bookmarks, help articles, emails) and the location section each
 * one opens. `suffix` is appended to the location path (a `?search` and/or `#hash`).
 */
export const PORTFOLIO_SECTIONS: Record<string, { section: LocationSection; suffix?: string }> = {
  "/keywords": { section: "keywords" },
  "/rankings": { section: "rankings" },
  "/rankings/tracker": { section: "rankings/tracker" },
  "/rankings/keywords": { section: "keywords" },
  "/rankings/keyword-groups": { section: "keywords", suffix: "#groups" },
  "/rankings/map-rankings": { section: "rankings/map" },
  "/rankings/local-search-grid": { section: "rankings/grid" },
  "/rankings/competitors": { section: "competitors" },
  "/competitors": { section: "competitors" },
  "/gbp": { section: "gbp" },
  "/gbp/audit": { section: "gbp/audit" },
  "/gbp/competitors": { section: "gbp/comparison" },
  "/gbp/reviews": { section: "reputation" },
  "/gbp/ai-posts": { section: "ai/posts" },
  "/gbp/review-management": { section: "ai/replies" },
  "/gbp/review-management/automation": { section: "ai/replies" },
  "/reputation": { section: "reputation" },
  "/reputation/reviews": { section: "reputation" },
  "/reputation/insights": { section: "reputation/insights" },
  "/reputation/review-management": { section: "ai/replies" },
  "/reputation/review-management/automation": { section: "ai/replies" },
  "/citations": { section: "citations" },
  "/ai": { section: "ai" },
  "/ai/posts": { section: "ai/posts" },
  "/ai/replies": { section: "ai/replies" },
  "/ai/settings": { section: "ai/settings" },
};

/** A link split into its path (no trailing slash), `?search` and `#hash`. */
export function splitLink(to: string): { pathname: string; search: string; hash: string } {
  const hashAt = to.indexOf("#");
  const hash = hashAt >= 0 ? to.slice(hashAt) : "";
  const beforeHash = hashAt >= 0 ? to.slice(0, hashAt) : to;
  const searchAt = beforeHash.indexOf("?");
  const search = searchAt >= 0 ? beforeHash.slice(searchAt) : "";
  const path = searchAt >= 0 ? beforeHash.slice(0, searchAt) : beforeHash;
  return { pathname: path.replace(/\/+$/, "") || "/", search: search === "?" ? "" : search, hash: hash === "#" ? "" : hash };
}

/**
 * `to` with `extra` added: the extra `?search` parameters join the link's own (the link's win
 * on a clash) and the extra `#hash` is used when the link has none.
 */
export function withSearchAndHash(to: string, extra: { search?: string; hash?: string }): string {
  const own = splitLink(to);
  const path = to.split(/[?#]/, 1)[0] ?? "";
  const params = new URLSearchParams(extra.search ?? "");
  for (const [key, value] of new URLSearchParams(own.search)) params.set(key, value);
  const search = params.toString();
  const hash = own.hash || (extra.hash && extra.hash !== "#" ? extra.hash : "");
  return `${path}${search ? `?${search}` : ""}${hash}`;
}

/**
 * The portfolio address that `pathname` falls under, with its location section. Exact first,
 * then the closest parent (`/gbp/ai-posts/new` → `/gbp/ai-posts`). Null for any other path.
 */
export function portfolioSectionFor(pathname: string): { path: string; section: LocationSection; suffix?: string } | null {
  let path = pathname.replace(/\/+$/, "") || "/";
  while (path && path !== "/") {
    const target = PORTFOLIO_SECTIONS[path];
    if (target) return { path, ...target };
    path = path.slice(0, path.lastIndexOf("/"));
  }
  return null;
}

/**
 * Turns an app link into its final address when it is a portfolio path and a location is
 * known: `/rankings/tracker` → `/locations/<id>/rankings/tracker`. The link's own search and
 * hash are kept (with the section's own suffix added). Any other link is returned unchanged.
 */
export function resolveAppLink(to: string, locationId: string | null | undefined): string {
  if (!locationId) return to;
  const { pathname, search, hash } = splitLink(to);
  const target = PORTFOLIO_SECTIONS[pathname];
  if (!target) return to;
  return withSearchAndHash(locationPath(locationId, target.section, target.suffix ?? ""), { search, hash });
}
