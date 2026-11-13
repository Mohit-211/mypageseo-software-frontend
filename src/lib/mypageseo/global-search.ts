/**
 * Global search: the app's pages (from the navigation model, so names and addresses match the
 * sidebar), the workspace's locations and clients, every location's pages, and the tracked
 * keywords of the location in context. There's no search endpoint on the backend: everything is
 * indexed in the browser from data the app already has.
 *
 * Every result carries its final address (`/locations/:id/…` for location pages), so opening one
 * never passes through a redirect page.
 */
import {
  Bell,
  CalendarDays,
  CircleHelp,
  CreditCard,
  FileText,
  Link2,
  LifeBuoy,
  Mail,
  MapPin,
  Palette,
  Plug,
  Plus,
  Settings,
  Tags,
  User,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ModuleTone } from "@/components/layout/shared/module-tone";
import type { Permission } from "./access";
import { navHref, navigationFor, type AccountType, type NavEntry, type NavItem } from "./navigation";
import { locationPath, type LocationSection } from "./section-links";

export type SearchGroupId = "pages" | "locations" | "location-pages" | "keywords" | "clients";

export const SEARCH_GROUP_LABELS: Record<SearchGroupId, string> = {
  pages: "Pages",
  locations: "Locations",
  "location-pages": "Pages of other locations",
  keywords: "Keywords",
  clients: "Clients",
};

/** Default group order (when two groups match equally well). */
const GROUP_ORDER: SearchGroupId[] = ["pages", "locations", "keywords", "location-pages", "clients"];

const GROUP_LIMIT: Record<SearchGroupId, number> = { pages: 6, locations: 5, "location-pages": 5, keywords: 5, clients: 5 };

export type SearchResult = {
  id: string;
  group: SearchGroupId;
  title: string;
  /** Second line: what it belongs to (the location a page opens for, a client's location count…). */
  context: string | null;
  /** Final address, search and hash included. */
  to: string;
  icon: LucideIcon;
  /** Module colour of its icon chip (the same as the page's header). */
  tone: ModuleTone;
  /** Opening it makes this the active location / client. */
  locationId: string | null;
  clientId: string | null;
  /** Extra words matched, never shown. */
  haystack: string;
  /**
   * Pages of other locations only match when part of the query names the location
   * ("mississauga tracker"), so a bare "tracker" lists the current location's page once.
   */
  needsContextMatch: boolean;
};

export type SearchLocation = { id: string; clientId?: string | undefined; businessName: string; area: string; city?: string | undefined };

export type SearchScope = {
  accountType: AccountType;
  /** The signed-in user's permission check (`useAccess().can`). */
  can: (permission: Permission) => boolean;
  /** The location that location pages open for (URL, else remembered, else first). */
  navLocationId: string | null;
  /** The workspace's real locations and clients (`GET locations`, `GET clients`). */
  locations: readonly SearchLocation[];
  clients: readonly { id: string; name: string }[];
  /** Tracked keywords of the nav location, once loaded. */
  keywords?: readonly string[];
};

/** One-line explanations for pages that aren't about one location. */
const PAGE_CONTEXT: Record<string, string> = {
  dashboard: "What changed, and what to do next",
  locations: "Every location in this workspace",
  "ai.visibility": "Coming soon",
  "white-label": "Your brand, client links and reports",
  reports: "PDF reports and monthly emails",
  clients: "Client accounts and their locations",
};

type ExtraPage = {
  id: string;
  title: string;
  context: string;
  to: string;
  icon: LucideIcon;
  tone: ModuleTone;
  keywords: string;
  accountTypes?: AccountType[];
  permission?: Permission;
  hiddenWithPermission?: Permission;
};

/** Pages that aren't in the sidebar but people look for by name. */
const EXTRA_PAGES: ExtraPage[] = [
  { id: "locations.add", title: "Add location", context: "Locations", to: "/locations/add", icon: Plus, tone: "locations", keywords: "new location connect google business profile maps", permission: "workspace.edit" },
  { id: "posts.calendar", title: "Posts calendar", context: "Every location's posts", to: "/gbp/posts", icon: CalendarDays, tone: "posts", keywords: "all posts schedule calendar google posts" },
  { id: "white-label.brand", title: "Brand", context: "White Label", to: "/white-label#brand", icon: Palette, tone: "reports", keywords: "branding logo colours colors white-label", accountTypes: ["agency"], permission: "clients.view" },
  { id: "white-label.links", title: "Client links", context: "White Label", to: "/white-label#links", icon: Link2, tone: "reports", keywords: "client link live page share white-label", accountTypes: ["agency"], permission: "clients.view" },
  { id: "white-label.reports", title: "PDF reports", context: "White Label", to: "/white-label#reports", icon: FileText, tone: "reports", keywords: "reports pdf download share", accountTypes: ["agency"], permission: "clients.view" },
  { id: "white-label.schedules", title: "Monthly emails", context: "White Label", to: "/white-label#schedules", icon: Mail, tone: "reports", keywords: "scheduled reports email schedule", accountTypes: ["agency"], permission: "clients.view" },
  { id: "reports.schedules", title: "Monthly emails", context: "Reports", to: "/reports#schedules", icon: Mail, tone: "reports", keywords: "scheduled reports email schedule", hiddenWithPermission: "clients.view" },
  { id: "settings.organization", title: "Organization settings", context: "Settings", to: "/settings", icon: Settings, tone: "settings", keywords: "general organization name timezone", permission: "settings.manage" },
  { id: "settings.profile", title: "Profile", context: "Settings", to: "/settings/profile", icon: User, tone: "settings", keywords: "my account name email password phone" },
  { id: "settings.team", title: "Team", context: "Settings", to: "/settings/team", icon: UserPlus, tone: "settings", keywords: "members invite teammates roles", permission: "team.view" },
  { id: "settings.billing", title: "Billing", context: "Settings", to: "/settings/billing", icon: CreditCard, tone: "settings", keywords: "plan subscription invoices payment tokens", permission: "billing.view" },
  { id: "settings.integrations", title: "Integrations", context: "Settings", to: "/settings/integrations", icon: Plug, tone: "settings", keywords: "google accounts connect connections", permission: "integrations.manage" },
  { id: "settings.notifications", title: "Notification settings", context: "Settings", to: "/settings/notifications", icon: Bell, tone: "settings", keywords: "alerts emails notifications" },
  { id: "help", title: "Help", context: "Guides and answers", to: "/help", icon: CircleHelp, tone: "help", keywords: "help docs faq how to guide" },
  { id: "support", title: "Support tickets", context: "Help", to: "/support", icon: LifeBuoy, tone: "help", keywords: "contact support ticket problem" },
];

/** A page of one location: its title, the section's label and its search words. */
type LocationPage = { entry: NavEntry; item: NavItem; parent: NavItem | null };

function locationPagesOf(items: readonly NavItem[]): LocationPage[] {
  const pages: LocationPage[] = [];
  for (const item of items) {
    if (item.children?.length) {
      for (const child of item.children) if (child.section !== undefined) pages.push({ entry: child, item, parent: item });
    } else if (item.section !== undefined) {
      pages.push({ entry: item, item, parent: null });
    }
  }
  return pages;
}

function pageWords(page: LocationPage): string {
  return [page.parent?.label, page.parent?.keywords, page.entry.keywords, page.item.group === "ai" ? "ai artificial intelligence" : null]
    .filter(Boolean)
    .join(" ");
}

/** Everything the signed-in account can jump to. */
export function buildSearchIndex(scope: SearchScope): SearchResult[] {
  const entries: SearchResult[] = [];
  const items = navigationFor(scope.accountType, scope.can);
  const agency = scope.accountType === "agency";
  const clientName = (id: string | undefined) => (id ? (scope.clients.find((client) => client.id === id)?.name ?? null) : null);
  const navLocation = scope.locations.find((location) => location.id === scope.navLocationId) ?? null;
  const locationPages = locationPagesOf(items);

  // Pages of the menu. Location pages open for the location in context (none without one).
  for (const item of items) {
    if (item.section !== undefined || item.children?.some((child) => child.section !== undefined)) continue;
    const to = navHref(item, null);
    if (!to) continue;
    entries.push({
      id: `page:${item.id}`,
      group: "pages",
      title: item.searchTitle ?? item.label,
      context: PAGE_CONTEXT[item.id] ?? null,
      to,
      icon: item.icon,
      tone: item.tone,
      locationId: null,
      clientId: null,
      haystack: item.keywords ?? "",
      needsContextMatch: false,
    });
  }
  if (navLocation) {
    for (const page of locationPages) {
      entries.push({
        id: `page:${page.entry.id}`,
        group: "pages",
        title: page.entry.searchTitle ?? page.entry.label,
        context: [page.parent?.label, navLocation.businessName].filter(Boolean).join(" · "),
        to: locationPath(navLocation.id, page.entry.section as LocationSection),
        icon: page.item.icon,
        tone: page.item.tone,
        locationId: navLocation.id,
        clientId: null,
        haystack: pageWords(page),
        needsContextMatch: false,
      });
    }
    entries.push({
      id: "page:keywords.groups",
      group: "pages",
      title: "Keyword groups",
      context: `Keywords · ${navLocation.businessName}`,
      to: locationPath(navLocation.id, "keywords", "#groups"),
      icon: Tags,
      tone: "keywords",
      locationId: navLocation.id,
      clientId: null,
      haystack: "keywords groups organise organize",
      needsContextMatch: false,
    });
  }
  for (const page of EXTRA_PAGES) {
    if (page.accountTypes && !page.accountTypes.includes(scope.accountType)) continue;
    if (page.permission && !scope.can(page.permission)) continue;
    if (page.hiddenWithPermission && scope.can(page.hiddenWithPermission)) continue;
    entries.push({
      id: `page:${page.id}`,
      group: "pages",
      title: page.title,
      context: page.context,
      to: page.to,
      icon: page.icon,
      tone: page.tone,
      locationId: null,
      clientId: null,
      haystack: page.keywords,
      needsContextMatch: false,
    });
  }

  for (const location of scope.locations) {
    const owner = agency ? clientName(location.clientId) : null;
    entries.push({
      id: `loc:${location.id}`,
      group: "locations",
      title: location.businessName,
      context: [location.area, agency ? (owner ?? "No client") : null].filter(Boolean).join(" · ") || null,
      to: locationPath(location.id),
      icon: MapPin,
      tone: "locations",
      locationId: location.id,
      clientId: null,
      haystack: [location.area, owner, "location business"].filter(Boolean).join(" "),
      needsContextMatch: false,
    });
    if (location.id === navLocation?.id) continue;
    for (const page of locationPages) {
      entries.push({
        id: `lp:${location.id}:${page.entry.id}`,
        group: "location-pages",
        title: page.entry.searchTitle ?? page.entry.label,
        context: [location.businessName, location.city || location.area].filter(Boolean).join(" · "),
        to: locationPath(location.id, page.entry.section as LocationSection),
        icon: page.item.icon,
        tone: page.item.tone,
        locationId: location.id,
        clientId: null,
        haystack: pageWords(page),
        needsContextMatch: true,
      });
    }
  }

  if (agency) {
    for (const client of scope.clients) {
      const count = scope.locations.filter((location) => location.clientId === client.id).length;
      entries.push({
        id: `cli:${client.id}`,
        group: "clients",
        title: client.name,
        context: `${count} location${count === 1 ? "" : "s"}`,
        to: `/clients/${encodeURIComponent(client.id)}`,
        icon: Users,
        tone: "clients",
        locationId: null,
        clientId: client.id,
        haystack: "client account",
        needsContextMatch: false,
      });
    }
  }

  if (navLocation) {
    for (const keyword of scope.keywords ?? []) {
      entries.push({
        id: `kw:${navLocation.id}:${keyword}`,
        group: "keywords",
        title: keyword,
        context: `Tracked keyword · ${navLocation.businessName}`,
        to: locationPath(navLocation.id, "keywords", `?keyword=${encodeURIComponent(keyword)}`),
        icon: Tags,
        tone: "keywords",
        locationId: navLocation.id,
        clientId: null,
        haystack: "keyword search term",
        needsContextMatch: false,
      });
    }
  }

  return entries;
}

export type SearchGroup = { id: SearchGroupId | "recent" | "suggested"; label: string; results: SearchResult[] };

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** True when a word of `text` starts with `token` ("harbor dental – mississauga" / "miss"). */
function wordStartsWith(text: string, token: string): boolean {
  return text.split(/[\s–—\-·,/()]+/).some((word) => word.startsWith(token));
}

/**
 * How well `result` matches (lower is better), or -1. Every word of the query has to match the
 * title, the hidden words or the context, and at least one has to match the thing itself (its
 * title or hidden words), so "downtown" doesn't list every page of the Downtown location.
 */
function scoreResult(result: SearchResult, query: string, tokens: string[]): number {
  const title = result.title.toLowerCase();
  // A whole-query title match never names the location, so it can't open another location's page.
  if (!result.needsContextMatch) {
    if (title === query) return 0;
    if (title.startsWith(query)) return 1;
    if (wordStartsWith(title, query)) return 2;
  }

  const context = (result.context ?? "").toLowerCase();
  const haystack = result.haystack.toLowerCase();
  let total = 0;
  let ownHit = false;
  let contextHit = false;
  for (const token of tokens) {
    if (context.includes(token)) contextHit = true;
    if (title.startsWith(token)) total += 2.5;
    else if (wordStartsWith(title, token)) total += 3;
    else if (title.includes(token)) total += 3.5;
    else if (haystack.includes(token)) total += 4.5;
    else if (context.includes(token)) {
      total += 5;
      continue;
    } else return -1;
    ownHit = true;
  }
  if (!ownHit) return -1;
  if (result.needsContextMatch && !contextHit) return -1;
  return total / tokens.length;
}

/** Grouped matches: best first inside each group, and the group with the best match first. */
export function searchIndex(entries: readonly SearchResult[], rawQuery: string): SearchGroup[] {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, " ");
  if (!query) return [];
  const tokens = query.split(" ");

  const byGroup = new Map<SearchGroupId, { result: SearchResult; rank: number }[]>();
  for (const result of entries) {
    const rank = scoreResult(result, query, tokens);
    if (rank < 0) continue;
    const list = byGroup.get(result.group) ?? [];
    list.push({ result, rank });
    byGroup.set(result.group, list);
  }

  const groups: { group: SearchGroup; best: number; order: number }[] = [];
  for (const [id, list] of byGroup) {
    list.sort((a, b) => a.rank - b.rank || collator.compare(a.result.title, b.result.title));
    groups.push({
      group: { id, label: SEARCH_GROUP_LABELS[id], results: list.slice(0, GROUP_LIMIT[id]).map((entry) => entry.result) },
      best: list[0]!.rank,
      order: GROUP_ORDER.indexOf(id),
    });
  }
  groups.sort((a, b) => a.best - b.best || a.order - b.order);
  return groups.map((entry) => entry.group);
}

/** Pages offered before anything is typed (when they exist for this account). */
const SUGGESTED_PAGE_IDS = [
  "page:dashboard",
  "page:location.overview",
  "page:location.rankings.tracker",
  "page:location.gbp.posts",
  "page:location.reputation.reviews",
  "page:ai.replies",
  "page:ai.posts",
];

/** What the search shows before anything is typed: recent picks, key pages and locations. */
export function searchSuggestions(entries: readonly SearchResult[], recentIds: readonly string[]): SearchGroup[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const groups: SearchGroup[] = [];

  const recent = recentIds
    .map((id) => byId.get(id))
    .filter((entry): entry is SearchResult => Boolean(entry))
    .slice(0, 4);
  if (recent.length) groups.push({ id: "recent", label: "Recent", results: recent });
  const shown = new Set(recent.map((entry) => entry.id));

  const pages = SUGGESTED_PAGE_IDS.map((id) => byId.get(id)).filter(
    (entry): entry is SearchResult => Boolean(entry) && !shown.has(entry!.id),
  );
  if (pages.length) groups.push({ id: "suggested", label: "Jump to", results: pages.slice(0, 6) });

  const locations = entries.filter((entry) => entry.group === "locations" && !shown.has(entry.id)).slice(0, 5);
  if (locations.length) groups.push({ id: "locations", label: SEARCH_GROUP_LABELS.locations, results: locations });

  return groups;
}

export function flattenGroups(groups: readonly SearchGroup[]): SearchResult[] {
  return groups.flatMap((group) => group.results);
}

/** Recently opened results, kept for this browser only. */
const RECENT_KEY = "mypageseo.search.recent.v2";
const RECENT_LIMIT = 6;

export function readRecentSearchIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function rememberSearchId(id: string): string[] {
  const next = [id, ...readRecentSearchIds().filter((entry) => entry !== id)].slice(0, RECENT_LIMIT);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: recents are optional.
    }
  }
  return next;
}
