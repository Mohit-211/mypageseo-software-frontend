/**
 * The app's navigation model. The sidebar and global search both read it, so every page has
 * one name, one icon and one address everywhere.
 *
 * Location pages are described by their section (`section-links.ts`) instead of a path: they
 * resolve to `/locations/:id/…` for the location in context, so a click never passes through a
 * redirect page (the cause of the blank flash between pages).
 */
import { matchPath } from "react-router-dom";
import {
  Building2,
  FileBarChart,
  Gauge,
  LayoutDashboard,
  ListChecks,
  MapPin,
  MessageSquareHeart,
  MessageSquareReply,
  PenLine,
  Radar,
  SlidersHorizontal,
  Sparkles,
  Stamp,
  Swords,
  Tags,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ModuleTone } from "@/components/layout/shared/module-tone";
import { hasPermission, resolveAccessProfile, type Permission } from "./access";
import { locationPath, portfolioSectionFor, type LocationSection } from "./section-links";

export type AccountType = "agency" | "business";

export type NavGroupId = "overview" | "location" | "ai" | "workspace";

export type NavGroup = {
  id: NavGroupId;
  label: string;
  /** False for the location group: the location switcher card heads it instead of a label. */
  labelled: boolean;
};

/** Sidebar groups, top to bottom. */
export const NAV_GROUPS: readonly NavGroup[] = [
  { id: "overview", label: "Overview", labelled: true },
  { id: "location", label: "Location", labelled: false },
  { id: "ai", label: "AI", labelled: true },
  { id: "workspace", label: "Workspace", labelled: true },
];

/** One destination: a fixed path (`to`) or a page of the location in context (`section`). */
export type NavEntry = {
  /** Stable id (sidebar keys, search results, recents). */
  id: string;
  label: string;
  to?: string;
  section?: LocationSection;
  /**
   * Route patterns (`matchPath`) that make this entry current. Across the whole menu the most
   * specific matching pattern wins (see `activeNavFor`).
   */
  match: readonly string[];
  /** Global search title when the label alone is ambiguous ("Overview"). */
  searchTitle?: string;
  /** Extra words global search matches; never shown. */
  keywords?: string;
};

export type NavItem = NavEntry & {
  group: NavGroupId;
  icon: LucideIcon;
  /** Module colour (icon chips in search, page headers). */
  tone: ModuleTone;
  /** Sub-pages. The row itself links to the first child. */
  children?: readonly NavEntry[];
  /** Only for these account types (omitted: both). */
  accountTypes?: readonly AccountType[];
  /** Only shown with this permission. */
  permission?: Permission;
  /** Hidden when the user holds this permission (Reports gives way to White Label). */
  hiddenWithPermission?: Permission;
  /** Planned, not built yet: the page shows a "coming soon" state. */
  soon?: boolean;
};

const L = "/locations/:locationId";

/** Every sidebar entry, in menu order. Labels are the canonical page names. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "dashboard",
    group: "overview",
    label: "Dashboard",
    icon: LayoutDashboard,
    tone: "dashboard",
    to: "/dashboard",
    match: ["/dashboard/*"],
    keywords: "home today summary next steps kpis portfolio",
  },
  {
    id: "locations",
    group: "overview",
    label: "Locations",
    icon: MapPin,
    tone: "locations",
    to: "/locations",
    // The list, adding a location and the setup wizard all belong to Locations.
    match: ["/locations", "/locations/add/*", `${L}/setup/*`],
    keywords: "businesses all locations list",
  },
  {
    id: "location.overview",
    group: "location",
    label: "Overview",
    searchTitle: "Location overview",
    icon: Gauge,
    tone: "locations",
    section: "overview",
    match: [L],
    keywords: "location summary health at a glance",
  },
  {
    id: "location.keywords",
    group: "location",
    label: "Keywords",
    icon: Tags,
    tone: "keywords",
    section: "keywords",
    match: [`${L}/keywords/*`, `${L}/rankings/keywords/*`, `${L}/rankings/groups/*`],
    keywords: "searches search terms tracked keywords groups ideas suggestions",
  },
  {
    id: "location.rankings",
    group: "location",
    label: "Rankings",
    icon: TrendingUp,
    tone: "rankings",
    section: "rankings",
    match: [`${L}/rankings/*`],
    keywords: "rank positions google maps visibility top 3 map pack",
    children: [
      {
        id: "location.rankings.overview",
        label: "Rank Overview",
        section: "rankings",
        match: [`${L}/rankings`],
        keywords: "rankings summary average rank top 3 rate trend",
      },
      {
        id: "location.rankings.tracker",
        label: "Rank Tracker",
        section: "rankings/tracker",
        match: [`${L}/rankings/tracker/*`],
        keywords: "keyword ranks positions table history",
      },
      {
        id: "location.rankings.map",
        label: "Map Rankings",
        section: "rankings/map",
        match: [`${L}/rankings/map/*`],
        keywords: "map pins who ranks search spot",
      },
      {
        id: "location.rankings.grid",
        label: "Local Search Grid",
        section: "rankings/grid",
        match: [`${L}/rankings/grid/*`],
        keywords: "grid heatmap geo area coverage",
      },
    ],
  },
  {
    id: "location.gbp",
    group: "location",
    label: "GBP",
    icon: Building2,
    tone: "gbp",
    section: "gbp",
    match: [`${L}/gbp/*`],
    keywords: "google business profile listing",
    children: [
      {
        id: "location.gbp.overview",
        label: "Overview",
        searchTitle: "GBP overview",
        section: "gbp",
        match: [`${L}/gbp`],
        keywords: "google business profile views calls website clicks performance",
      },
      {
        id: "location.gbp.audit",
        label: "Audit",
        searchTitle: "GBP audit",
        section: "gbp/audit",
        match: [`${L}/gbp/audit`],
        keywords: "profile score grade fixes completeness google business profile",
      },
      {
        id: "location.gbp.comparison",
        label: "Profile Comparison",
        section: "gbp/comparison",
        match: [`${L}/gbp/audit/competitors/*`],
        keywords: "competitor profiles compare reviews photos categories",
      },
      {
        id: "location.gbp.posts",
        label: "Posts",
        section: "gbp/posts",
        // Not the organization-wide calendar (`/gbp/posts`): it covers every location, so no
        // location's entry is current there (like Help, it has no menu entry of its own).
        match: [`${L}/gbp/posts/*`],
        keywords: "google posts schedule publish calendar offers events updates",
      },
    ],
  },
  {
    id: "location.reputation",
    group: "location",
    label: "Reputation",
    icon: MessageSquareHeart,
    tone: "reputation",
    section: "reputation",
    match: [`${L}/reputation/*`, `${L}/gbp/reviews/*`],
    keywords: "reviews ratings stars",
    children: [
      {
        id: "location.reputation.reviews",
        label: "Reviews",
        section: "reputation",
        match: [`${L}/reputation`, `${L}/gbp/reviews/*`],
        keywords: "reply respond unanswered needs reply ratings stars",
      },
      {
        id: "location.reputation.insights",
        label: "Insights",
        searchTitle: "Review insights",
        section: "reputation/insights",
        match: [`${L}/reputation/insights/*`],
        keywords: "themes sentiment praise complaints summary",
      },
    ],
  },
  {
    id: "location.citations",
    group: "location",
    label: "Citations",
    icon: ListChecks,
    tone: "citations",
    section: "citations",
    match: [`${L}/citations/*`],
    keywords: "directories listings name address phone nap",
  },
  {
    id: "location.competitors",
    group: "location",
    label: "Competitors",
    icon: Swords,
    tone: "competitors",
    section: "competitors",
    match: [`${L}/rankings/competitors/*`, `${L}/competitors/*`],
    keywords: "competition rivals nearby businesses compare rankings",
  },
  {
    id: "ai.studio",
    group: "ai",
    label: "AI Studio",
    icon: Sparkles,
    tone: "ai",
    section: "ai",
    match: [`${L}/ai`],
    keywords: "ai assistant artificial intelligence automation tokens",
  },
  {
    id: "ai.posts",
    group: "ai",
    label: "AI Posts",
    icon: PenLine,
    tone: "ai",
    section: "ai/posts",
    match: [`${L}/ai/posts/*`],
    keywords: "write posts with ai auto-post auto posting schedule ideas captions images",
  },
  {
    id: "ai.replies",
    group: "ai",
    label: "AI Review Replies",
    icon: MessageSquareReply,
    tone: "ai",
    section: "ai/replies",
    match: [`${L}/ai/replies/*`],
    keywords: "reply respond answer reviews draft ai responses review management",
  },
  {
    id: "ai.settings",
    group: "ai",
    label: "AI Settings",
    icon: SlidersHorizontal,
    tone: "ai",
    section: "ai/settings",
    match: [`${L}/ai/settings/*`],
    keywords: "house rules signature contact line restricted mode facts for the ai offers events contests logo ai images photos tone voice",
  },
  {
    id: "ai.visibility",
    group: "ai",
    label: "AI Visibility",
    icon: Radar,
    tone: "ai",
    to: "/ai-visibility",
    match: ["/ai-visibility/*"],
    soon: true,
    keywords: "chatgpt gemini perplexity claude ai assistants answers",
  },
  {
    id: "white-label",
    group: "workspace",
    label: "White Label",
    icon: Stamp,
    tone: "reports",
    to: "/white-label",
    // Report detail pages and the old branding settings belong to White Label for agency staff.
    match: ["/white-label/*", "/reports/*", "/settings/white-label/*"],
    accountTypes: ["agency"],
    permission: "clients.view",
    keywords: "reports branding brand logo colours client links pdf schedules monthly emails",
  },
  {
    id: "reports",
    group: "workspace",
    label: "Reports",
    icon: FileBarChart,
    tone: "reports",
    to: "/reports",
    match: ["/reports/*"],
    hiddenWithPermission: "clients.view",
    keywords: "pdf reports schedules monthly emails share download",
  },
  {
    id: "clients",
    group: "workspace",
    label: "Clients",
    icon: Users,
    tone: "clients",
    to: "/clients",
    match: ["/clients/*"],
    accountTypes: ["agency"],
    permission: "clients.view",
    keywords: "client accounts agency customers client users",
  },
];

/**
 * The items this account sees, in menu order. `can` is the signed-in user's permission check
 * (`useAccess().can`); without it the account type's owner permissions apply.
 */
export function navigationFor(accountType: AccountType, can?: (permission: Permission) => boolean): NavItem[] {
  const allowed = can ?? ((permission: Permission) => hasPermission(resolveAccessProfile(accountType), permission));
  return NAV_ITEMS.filter(
    (item) =>
      (!item.accountTypes || item.accountTypes.includes(accountType)) &&
      (!item.permission || allowed(item.permission)) &&
      (!item.hiddenWithPermission || !allowed(item.hiddenWithPermission)),
  );
}

/** True for entries that need a location (`/locations/:id/…`). */
export function isLocationEntry(entry: NavEntry): boolean {
  return entry.section !== undefined;
}

/**
 * The address of an entry. Location pages use `locationId` and are null without one
 * (no locations yet), so the sidebar can show them disabled.
 */
export function navHref(entry: NavEntry, locationId: string | null | undefined): string | null {
  if (entry.section !== undefined) return locationId ? locationPath(locationId, entry.section) : null;
  return entry.to ?? null;
}

/** Where an item's row goes: its first child when it has sub-pages, else the item itself. */
export function navItemHref(item: NavItem, locationId: string | null | undefined): string | null {
  return navHref(item.children?.[0] ?? item, locationId);
}

/**
 * How specific a route pattern is: a static segment beats a parameter, and a trailing splat
 * loses to an exact match. `/locations/:id/rankings/competitors/*` (31) beats
 * `/locations/:id/rankings/*` (21), and `/locations/add` (20) beats `/locations/:id` (13).
 */
export function patternScore(pattern: string): number {
  let score = 0;
  for (const segment of pattern.split("/")) {
    if (!segment) continue;
    if (segment === "*") score -= 2;
    else if (segment.startsWith(":")) score += 3;
    else score += 10;
  }
  return score;
}

export type ActiveNav = {
  itemId: string;
  /** The current sub-page of a parent item, else null. */
  childId: string | null;
};

/** Stands in for the location id when an old portfolio address is matched as a location page. */
const PORTFOLIO_LOCATION = "_";

/**
 * The current menu entry for `pathname`: the most specific pattern that matches across every
 * item and child (`/locations/:id/rankings/competitors` → Competitors, not Rankings;
 * `/locations/:id` → Overview; `/locations/:id/setup` → Locations). Old portfolio addresses
 * (`/rankings/tracker`, `/gbp/audit` …) count as the location page they open, so the right item
 * is lit while they hand over. Null when no entry owns the page (Settings, Help …).
 */
export function activeNavFor(items: readonly NavItem[], pathname: string): ActiveNav | null {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  const portfolio = portfolioSectionFor(trimmed);
  const path = portfolio && portfolio.path === trimmed ? locationPath(PORTFOLIO_LOCATION, portfolio.section) : trimmed;

  let best: (ActiveNav & { score: number }) | null = null;
  for (const item of items) {
    const candidates: { entry: NavEntry; childId: string | null }[] = [
      { entry: item, childId: null },
      ...(item.children ?? []).map((child) => ({ entry: child, childId: child.id })),
    ];
    for (const { entry, childId } of candidates) {
      for (const pattern of entry.match) {
        if (!matchPath(pattern, path)) continue;
        const score = patternScore(pattern);
        // Strictly greater: on a tie the entry higher in the menu keeps it.
        if (!best || score > best.score) best = { itemId: item.id, childId, score };
      }
    }
  }
  return best ? { itemId: best.itemId, childId: best.childId } : null;
}

/** The location id in a `/locations/:locationId/…` address ("add" is not a location). */
export function routeLocationIdFrom(pathname: string): string | null {
  const id = matchPath("/locations/:locationId/*", pathname)?.params.locationId;
  return id && id !== "add" ? id : null;
}

/**
 * Where switching to another location takes the user: the same page of the new location
 * (`/locations/A/gbp/posts` → `/locations/B/gbp/posts`, without the old search string, which
 * belongs to the old location). Null when the current page isn't a location page, so the user
 * stays put. The setup wizard belongs to the location being set up: another location opens on
 * its overview instead.
 */
export function locationSwitchTarget(pathname: string, nextLocationId: string): string | null {
  const match = matchPath("/locations/:locationId/*", pathname);
  const current = match?.params.locationId;
  if (!match || !current || current === "add") return null;
  const rest = (match.params["*"] ?? "").replace(/^\/+|\/+$/g, "");
  if (rest === "setup" || rest.startsWith("setup/")) return locationPath(nextLocationId);
  return `/locations/${encodeURIComponent(nextLocationId)}${rest ? `/${rest}` : ""}`;
}
