import {
  LayoutDashboard,
  MapPin,
  TrendingUp,
  Building2,
  ListChecks,
  Users,
  FileBarChart,
  Workflow,
  Sparkles,
  MessageSquareHeart,
  type LucideIcon,
} from "lucide-react";

export type AccountType = "agency" | "business";

export type NavGroup = "Overview" | "Visibility" | "Workspace";

export type NavItem = {
  label: string;
  /** Section heading the item sits under in the sidebar. */
  group: NavGroup;
  to: string;
  icon: LucideIcon;
  /** Only rendered for these account types. Omitted = both. */
  accountTypes?: AccountType[];
  /**
   * The section inside a location (`/locations/:id/<section>`) that belongs to this
   * entry, so it stays highlighted there instead of Locations.
   */
  locationSection?: string;
  /** `locationPath`: the child's path under that section ("" = the section itself). */
  children?: { label: string; to: string; locationPath?: string }[];
};

/** Primary product navigation. Terminology here is canonical across the app. */
export const primaryNavigation: NavItem[] = [
  { label: "Dashboard", group: "Overview", to: "/dashboard", icon: LayoutDashboard },
  { label: "Locations", group: "Overview", to: "/locations", icon: MapPin },
  {
    label: "Rankings",
    group: "Visibility",
    to: "/rankings",
    icon: TrendingUp,
    locationSection: "rankings",
    children: [
      { label: "Rank Overview", to: "/rankings", locationPath: "" },
      { label: "Rank Tracker", to: "/rankings/tracker", locationPath: "tracker" },
      { label: "Keywords", to: "/rankings/keywords", locationPath: "keywords" },
      { label: "Keyword Groups", to: "/rankings/keyword-groups", locationPath: "groups" },
      { label: "Map Rankings", to: "/rankings/map-rankings", locationPath: "map" },
      { label: "Local Search Grid", to: "/rankings/local-search-grid", locationPath: "grid" },
    ],
  },
  {
    label: "GBP",
    group: "Visibility",
    to: "/gbp",
    icon: Building2,
    locationSection: "gbp",
    children: [
      { label: "Overview", to: "/gbp", locationPath: "" },
      { label: "Audit", to: "/gbp/audit", locationPath: "audit" },
      { label: "Competitors", to: "/gbp/competitors", locationPath: "audit/competitors" },
      { label: "Posts", to: "/gbp/posts", locationPath: "posts" },
    ],
  },
  {
    // Reviews and their management (replies, automation, AI) are their own section.
    label: "Reputation",
    group: "Visibility",
    to: "/reputation",
    icon: MessageSquareHeart,
    locationSection: "reputation",
    children: [
      { label: "Reviews", to: "/reputation/reviews", locationPath: "" },
      { label: "Insights", to: "/reputation/insights", locationPath: "insights" },
    ],
  },
  { label: "Citations", group: "Visibility", to: "/citations", icon: ListChecks },
  { label: "Competitors", group: "Visibility", to: "/competitors", icon: Users },
  { label: "AI Visibility", group: "Visibility", to: "/ai-visibility", icon: Sparkles },
  { label: "Reports", group: "Workspace", to: "/reports", icon: FileBarChart, locationSection: "reports" },
  { label: "Clients", group: "Workspace", to: "/clients", icon: Users, accountTypes: ["agency"] },
  { label: "Automations", group: "Workspace", to: "/automations", icon: Workflow },
  // Settings opens from the workspace card at the foot of the sidebar.
];

export function navigationFor(accountType: AccountType): NavItem[] {
  return primaryNavigation.filter(
    (item) => !item.accountTypes || item.accountTypes.includes(accountType),
  );
}
