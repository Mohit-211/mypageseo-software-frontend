/**
 * Global search index for the application header: the workspace's locations,
 * clients and pages. There's no search endpoint on the backend.
 */

import { primaryNavigation, type AccountType } from "./navigation";

export type SearchGroupId =
  "locations" | "clients" | "keywords" | "reports" | "competitors" | "citations" | "pages";

export const SEARCH_GROUP_LABELS: Record<SearchGroupId, string> = {
  locations: "Locations",
  clients: "Clients",
  keywords: "Keywords",
  reports: "Reports",
  competitors: "Competitors",
  citations: "Citations",
  pages: "Pages",
};

/** Order groups are rendered in. */
const GROUP_ORDER: SearchGroupId[] = [
  "locations",
  "clients",
  "keywords",
  "competitors",
  "citations",
  "reports",
  "pages",
];

export type SearchTarget =
  | { kind: "location"; locationId: string }
  | { kind: "keywords"; locationId: string }
  | { kind: "competitor"; locationId: string; competitorId: string }
  | { kind: "citation"; locationId: string; citationId: string }
  | { kind: "report"; reportId: string }
  | { kind: "client"; clientId: string }
  | { kind: "page"; to: string };

export type SearchResult = {
  id: string;
  group: SearchGroupId;
  title: string;
  /** Short qualifier that distinguishes similar records. */
  context: string | null;
  /** Secondary detail such as a state or a metric already shown elsewhere. */
  meta: string | null;
  target: SearchTarget;
  /** Location this record belongs to, so selection can set workspace context. */
  locationId: string | null;
  /** Extra text matched against, never displayed. */
  haystack: string;
};

export type SearchScope = {
  accountType: AccountType;
  /** Agency only: limits results to one client when a client is selected. */
  activeClientId: string | null;
  /** The workspace's real locations and clients (`GET locations`, `GET clients`). */
  locations: { id: string; clientId?: string | undefined; businessName: string; area: string }[];
  clients: { id: string; name: string }[];
};

/**
 * Everything the signed-in account can jump to: its locations, its clients (agency)
 * and the app's pages. There is no search endpoint, so nothing else is indexed.
 */
export function buildSearchIndex(scope: SearchScope): SearchResult[] {
  const clientName = (id: string | undefined) => (id ? (scope.clients.find((client) => client.id === id)?.name ?? null) : null);
  const locations = scope.activeClientId ? scope.locations.filter((location) => location.clientId === scope.activeClientId) : scope.locations;
  const entries: SearchResult[] = [];

  for (const location of locations) {
    const owner = scope.accountType === "agency" ? clientName(location.clientId) : null;
    entries.push({
      id: `loc:${location.id}`,
      group: "locations",
      title: location.businessName,
      context: location.area,
      meta: owner,
      target: { kind: "location", locationId: location.id },
      locationId: location.id,
      haystack: owner ?? "",
    });
  }

  if (scope.accountType === "agency") {
    const visible = scope.activeClientId ? scope.clients.filter((client) => client.id === scope.activeClientId) : scope.clients;
    for (const client of visible) {
      const count = scope.locations.filter((location) => location.clientId === client.id).length;
      entries.push({
        id: `cli:${client.id}`,
        group: "clients",
        title: client.name,
        context: null,
        meta: `${count} location${count === 1 ? "" : "s"}`,
        target: { kind: "client", clientId: client.id },
        locationId: null,
        haystack: "client account",
      });
    }
  }

  for (const item of primaryNavigation) {
    if (item.accountTypes && !item.accountTypes.includes(scope.accountType)) continue;
    entries.push({
      id: `page:${item.to}`,
      group: "pages",
      title: item.label,
      context: item.to,
      meta: null,
      target: { kind: "page", to: item.to },
      locationId: null,
      haystack: "navigation section",
    });
    for (const child of item.children ?? []) {
      entries.push({
        id: `page:${child.to}`,
        group: "pages",
        title: `${item.label} · ${child.label}`,
        context: child.to,
        meta: null,
        target: { kind: "page", to: child.to },
        locationId: null,
        haystack: "navigation section",
      });
    }
  }

  return entries;
}

export type SearchGroup = { id: SearchGroupId; label: string; results: SearchResult[] };

const PER_GROUP_LIMIT = 5;

function score(result: SearchResult, query: string): number {
  const title = result.title.toLowerCase();
  const context = (result.context ?? "").toLowerCase();
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  if (context.includes(query)) return 3;
  if (result.haystack.toLowerCase().includes(query)) return 4;
  return -1;
}

/** Grouped matches, best first inside each group. */
export function searchIndex(entries: SearchResult[], rawQuery: string): SearchGroup[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const scored: { result: SearchResult; rank: number }[] = [];
  for (const result of entries) {
    const rank = score(result, query);
    if (rank >= 0) scored.push({ result, rank });
  }
  scored.sort((a, b) => a.rank - b.rank || a.result.title.localeCompare(b.result.title));

  const groups: SearchGroup[] = [];
  for (const id of GROUP_ORDER) {
    const results = scored
      .filter((entry) => entry.result.group === id)
      .slice(0, PER_GROUP_LIMIT)
      .map((entry) => entry.result);
    if (results.length) groups.push({ id, label: SEARCH_GROUP_LABELS[id], results });
  }
  return groups;
}

/**
 * Suggestions shown before anything is typed: the locations in context, the
 * latest reports and the main sections. Only records that already exist.
 */
export function searchSuggestions(entries: SearchResult[], recentIds: string[]): SearchGroup[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const groups: SearchGroup[] = [];

  const recent = recentIds
    .map((id) => byId.get(id))
    .filter((entry): entry is SearchResult => Boolean(entry))
    .slice(0, 4);
  if (recent.length) groups.push({ id: "locations", label: "Recent", results: recent });

  const recentSet = new Set(recent.map((entry) => entry.id));
  const take = (group: SearchGroupId, limit: number) =>
    entries.filter((entry) => entry.group === group && !recentSet.has(entry.id)).slice(0, limit);

  const clients = take("clients", 3);
  if (clients.length)
    groups.push({ id: "clients", label: SEARCH_GROUP_LABELS.clients, results: clients });

  const locations = take("locations", 4);
  if (locations.length)
    groups.push({ id: "locations", label: SEARCH_GROUP_LABELS.locations, results: locations });

  const reports = take("reports", 3);
  if (reports.length)
    groups.push({ id: "reports", label: SEARCH_GROUP_LABELS.reports, results: reports });

  const pages = take("pages", 5);
  if (pages.length) groups.push({ id: "pages", label: SEARCH_GROUP_LABELS.pages, results: pages });

  return groups;
}

export function flattenGroups(groups: SearchGroup[]): SearchResult[] {
  return groups.flatMap((group) => group.results);
}

/** Recently opened results, kept for this browser only. */
const RECENT_KEY = "mypageseo.search.recent.v1";
const RECENT_LIMIT = 6;

export function readRecentSearchIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function rememberSearchId(id: string): string[] {
  const next = [id, ...readRecentSearchIds().filter((entry) => entry !== id)].slice(
    0,
    RECENT_LIMIT,
  );
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — recents are optional */
    }
  }
  return next;
}
