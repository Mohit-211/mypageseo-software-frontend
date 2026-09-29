import {
  LayoutDashboard,
  MapPin,
  TrendingUp,
  Building2,
  ListChecks,
  Users,
  FileBarChart,
  Workflow,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type AccountType = "agency" | "business";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Only rendered for these account types. Omitted = both. */
  accountTypes?: AccountType[];
  children?: { label: string; to: string }[];
};

/** Primary product navigation. Terminology here is canonical across the app. */
export const primaryNavigation: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Locations", to: "/locations", icon: MapPin },
  {
    label: "Rankings",
    to: "/rankings",
    icon: TrendingUp,
    children: [
      { label: "Rank Overview", to: "/rankings" },
      { label: "Keywords", to: "/rankings/keywords" },
      { label: "Keyword Groups", to: "/rankings/keyword-groups" },
      { label: "Map Rankings", to: "/rankings/map-rankings" },
      { label: "Local Search Grid", to: "/rankings/local-search-grid" },
    ],
  },
  {
    label: "GBP",
    to: "/gbp",
    icon: Building2,
    children: [
      { label: "Overview", to: "/gbp" },
      { label: "Audit", to: "/gbp/audit" },
      { label: "Reviews", to: "/gbp/reviews" },
      { label: "Review Management", to: "/gbp/review-management" },
      { label: "Posts", to: "/gbp/posts" },
      { label: "AI Posts", to: "/gbp/ai-posts" },
    ],
  },
  { label: "Citations", to: "/citations", icon: ListChecks },
  { label: "Competitors", to: "/competitors", icon: Users },
  { label: "AI Visibility", to: "/ai-visibility", icon: Sparkles },
  { label: "Reports", to: "/reports", icon: FileBarChart },
  { label: "Clients", to: "/clients", icon: Users, accountTypes: ["agency"] },
  { label: "Automations", to: "/automations", icon: Workflow },
  { label: "Settings", to: "/settings", icon: Settings },
];

export function navigationFor(accountType: AccountType): NavItem[] {
  console.log(accountType,"accountType")
  return primaryNavigation.filter(
    (item) => !item.accountTypes || item.accountTypes.includes(accountType),
  );
}
