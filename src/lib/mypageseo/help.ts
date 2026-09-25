/**
 * Help content for the in-product help centre.
 *
 * There is no help-content backend connected to this frontend, so the articles
 * below are maintained as static product documentation. They describe what the
 * shipped screens actually do — nothing here promises functionality the product
 * does not have. When a content backend lands, replace `getHelp` with that read;
 * the types and the screen stay the same.
 */

import type { AccountType } from "./navigation";

export type HelpCategoryId =
  | "getting_started"
  | "locations"
  | "rankings"
  | "gbp"
  | "citations"
  | "competitors"
  | "reports"
  | "automations"
  | "agency"
  | "account";

export type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  /** Short paragraphs or steps. Kept plain text so it can come from a CMS later. */
  body: string[];
  /** Existing product screen this article is about. */
  link?: { label: string; to: string };
};

export type HelpCategory = {
  id: HelpCategoryId;
  label: string;
  description: string;
  /** Agency-only categories are hidden from business accounts. */
  accountTypes?: AccountType[];
  articles: HelpArticle[];
};

export type HelpSupport = {
  /** Support address configured for this workspace, or null when none is. */
  email: string | null;
  /** Whether a support-request backend exists. */
  canSubmitRequest: boolean;
  /** Published response expectations, only when the backend supplies them. */
  responseTime: string | null;
};

export type HelpResult =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; categories: HelpCategory[]; support: HelpSupport };

const CATEGORIES: HelpCategory[] = [
  {
    id: "getting_started",
    label: "Getting started",
    description: "Set up a workspace and understand how Mypageseo is organised.",
    articles: [
      {
        id: "help_structure",
        title: "How Mypageseo is organised",
        summary: "Organization, clients and locations, and why the location matters most.",
        body: [
          "Everything in Mypageseo hangs off a location — one Google Business Profile you are working on. Rankings, GBP data, citations, competitors and reports are all read for the location you have selected.",
          "Business accounts have one organization and its own locations. Agency accounts add a client layer: organization → client → location.",
          "Use the switchers in the header to change organization, client or location. The rest of the screen follows that selection.",
        ],
      },
      {
        id: "help_onboarding",
        title: "Finish or revisit setup",
        summary: "What each setup step collects and how to resume it.",
        body: [
          "Setup collects your business or agency details, connects Google, selects the profile to track, and optionally adds starting keywords and competitors.",
          "Your answers are kept as you move between steps, so you can go back without losing anything. Optional steps can be skipped and completed later from the product.",
          "Once setup is finished, opening setup again takes you straight to the dashboard.",
        ],
        link: { label: "Open setup", to: "/onboarding" },
      },
      {
        id: "help_search",
        title: "Find anything quickly",
        summary: "Use the header search to jump to locations, keywords, reports and sections.",
        body: [
          "The search field in the header searches locations, keywords, competitors, citations, reports and product sections you have access to.",
          "Use the arrow keys to move through results, Enter to open one and Escape to close. Opening a result also switches the workspace to that location.",
        ],
      },
    ],
  },
  {
    id: "locations",
    label: "Locations",
    description: "Manage the profiles you track and their working context.",
    articles: [
      {
        id: "help_locations_list",
        title: "Working with the locations list",
        summary: "Search, filter and open a location workspace.",
        body: [
          "The Locations screen lists every location you can access, with visibility, average rank, GBP health and review data for each one.",
          "Opening a location switches the workspace to it, so Rankings, GBP, Citations and Competitors all read that location.",
        ],
        link: { label: "Go to Locations", to: "/locations" },
      },
      {
        id: "help_location_states",
        title: "Location states",
        summary: "What active, setup required and disconnected mean.",
        body: [
          "Active: the profile is connected and data is updating.",
          "Setup required: the location exists but has not been matched to a Google Business Profile yet.",
          "Disconnected: the Google account no longer grants access, so profile, review and post data has stopped updating. Reconnect it from Integrations.",
        ],
        link: { label: "Open Integrations", to: "/settings/integrations" },
      },
    ],
  },
  {
    id: "rankings",
    label: "Rankings",
    description: "Track keyword positions, groups, map rankings and the local grid.",
    articles: [
      {
        id: "help_keywords",
        title: "Tracked keywords",
        summary: "How positions, movement and result types are shown.",
        body: [
          "Each tracked keyword shows its current position, the change against the previous check, its keyword group and whether the result came from Google or the local finder.",
          "Keywords that fall outside the tracked range are shown as not ranking rather than given a made-up position.",
        ],
        link: { label: "Open Keywords", to: "/rankings/keywords" },
      },
      {
        id: "help_keyword_groups",
        title: "Keyword groups",
        summary: "Group keywords by service or intent to read performance faster.",
        body: [
          "Groups collect related keywords — for example a service line or a neighbourhood — so you can see how a theme performs instead of scanning every term.",
          "Group membership is also used in reporting, so report sections stay consistent with what you see here.",
        ],
        link: { label: "Open Keyword Groups", to: "/rankings/keyword-groups" },
      },
      {
        id: "help_grid",
        title: "Map rankings and the local search grid",
        summary: "See how position changes across the area around the business.",
        body: [
          "Map rankings show where the profile appears in map results for tracked terms.",
          "The local search grid samples positions across a grid of points around the business, which shows how far the profile ranks from its own address.",
        ],
        link: { label: "Open Local Search Grid", to: "/rankings/local-search-grid" },
      },
    ],
  },
  {
    id: "gbp",
    label: "GBP",
    description: "Profile health, audits, reviews and posts.",
    articles: [
      {
        id: "help_gbp_audit",
        title: "Reading the GBP audit",
        summary: "What the audit checks and how to act on findings.",
        body: [
          "The audit checks the parts of a Google Business Profile that influence local visibility: categories, hours, attributes, description, photos and contact details.",
          "Findings are ordered by impact. Fixing high-impact items first usually moves profile health fastest.",
        ],
        link: { label: "Open GBP Audit", to: "/gbp/audit" },
      },
      {
        id: "help_reviews",
        title: "Reviews and replies",
        summary: "Track incoming reviews and which ones still need a response.",
        body: [
          "Reviews shows rating, volume and the reviews still awaiting a reply for the selected location.",
          "Replying requires a connected Google account with permission to manage the profile.",
        ],
        link: { label: "Open Reviews", to: "/gbp/reviews" },
      },
      {
        id: "help_posts",
        title: "Google posts",
        summary: "Review published and scheduled profile posts.",
        body: [
          "Posts lists what has been published to the profile and what is scheduled, with its current state.",
          "Posting and scheduling depend on the Google connection for that location.",
        ],
        link: { label: "Open Posts", to: "/gbp/posts" },
      },
    ],
  },
  {
    id: "citations",
    label: "Citations",
    description: "Directory listings and NAP consistency.",
    articles: [
      {
        id: "help_citation_states",
        title: "Citation states",
        summary: "Correct, inconsistent, missing, duplicate and pending.",
        body: [
          "Correct: the directory matches the name, address, phone and website you expect.",
          "Inconsistent: the listing exists but one or more details differ. Open it to see exactly which field is wrong.",
          "Missing: no listing was found on that directory. Duplicate: more than one listing was found, which splits signals.",
          "Pending: the directory has not been re-checked since the last change.",
        ],
        link: { label: "Open Citations", to: "/citations" },
      },
      {
        id: "help_nap",
        title: "Why NAP consistency matters",
        summary: "Consistent details across directories support local ranking.",
        body: [
          "Search engines cross-check business details across directories. Conflicting name, address or phone data weakens confidence in the listing.",
          "Fix high-authority directories first — they carry more weight than long-tail listings.",
        ],
      },
    ],
  },
  {
    id: "competitors",
    label: "Competitors",
    description: "Compare local rivals against the tracked location.",
    articles: [
      {
        id: "help_competitors",
        title: "Comparing competitors",
        summary: "What is compared and where the numbers come from.",
        body: [
          "Competitors are compared on average rank, rating, review volume, photos, citations and link data for the same area as your location.",
          "Competitor rankings show, keyword by keyword, where a rival outranks the tracked location.",
        ],
        link: { label: "Open Competitors", to: "/competitors" },
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    description: "Generate, schedule and share reporting.",
    articles: [
      {
        id: "help_report_types",
        title: "Report types",
        summary: "Rank tracker, GBP audit, competitor analysis and citation reports.",
        body: [
          "Each report type is built from the same data the product screens show, for one location and one reporting period.",
          "Reports move through scheduled, processing, generated and failed states. A failed report explains why it failed instead of producing an empty file.",
        ],
        link: { label: "Open Reports", to: "/reports" },
      },
      {
        id: "help_schedules",
        title: "Scheduled reports",
        summary: "Recurring delivery and what to check when one does not arrive.",
        body: [
          "Scheduled reports show the next delivery time and recipients.",
          "If a delivery is missing, check the schedule state first, then the location's Google connection — a disconnected profile stops the underlying data.",
        ],
        link: { label: "Open Scheduled Reports", to: "/reports/scheduled" },
      },
    ],
  },
  {
    id: "automations",
    label: "Automations",
    description: "Alerts, monitoring and scheduled delivery.",
    articles: [
      {
        id: "help_automation_types",
        title: "What can be automated",
        summary: "Ranking alerts, review alerts, citation monitoring, post scheduling and report delivery.",
        body: [
          "An automation combines a supported type, a scope (location, and client for agencies), a schedule or trigger, and the notification it produces.",
          "Each automation keeps an execution history, so a failed run shows when it ran and why it failed.",
        ],
        link: { label: "Open Automations", to: "/automations" },
      },
    ],
  },
  {
    id: "agency",
    label: "Agency management",
    description: "Clients, client users and white-label reporting.",
    accountTypes: ["agency"],
    articles: [
      {
        id: "help_clients",
        title: "Clients and their locations",
        summary: "How client scope affects everything else.",
        body: [
          "Each client holds its own locations. Selecting a client in the header narrows locations, rankings, reports and search to that client.",
          "Client users are people on the client side who can be given access to that client's records.",
        ],
        link: { label: "Open Clients", to: "/clients" },
      },
      {
        id: "help_white_label",
        title: "White-label reporting",
        summary: "Branding applied to generated reports.",
        body: [
          "Reporting branding uses the company name and logo configured for the workspace. Only the fields the reporting backend stores can be set.",
        ],
        link: { label: "Open White-label", to: "/settings/white-label" },
      },
    ],
  },
  {
    id: "account",
    label: "Account & billing",
    description: "Profile, team, notifications, integrations and subscription.",
    articles: [
      {
        id: "help_google_connection",
        title: "Google Business Profile connection",
        summary: "What the connection is used for and when to reconnect.",
        body: [
          "The Google connection authorises Mypageseo to read profile details, reviews, posts and profile performance for your locations.",
          "If a location shows reconnect required, the Google access has expired and that location's data has stopped updating until it is reauthorised.",
        ],
        link: { label: "Open Integrations", to: "/settings/integrations" },
      },
      {
        id: "help_notifications",
        title: "Notifications and preferences",
        summary: "The difference between the inbox and preference settings.",
        body: [
          "Notifications lists events that already happened — ranking movement, new reviews, citation issues, report delivery and automation results.",
          "Notification settings control which of those events reach you and on which channel. Security and account notices are always sent.",
        ],
        link: { label: "Open Notifications", to: "/notifications" },
      },
      {
        id: "help_billing",
        title: "Subscription and invoices",
        summary: "Where plan, usage, payment method and invoices live.",
        body: [
          "Billing shows the current plan, billing period, price, usage against the plan and past invoices.",
          "Plan changes and payment updates are handled by the billing provider connected to the workspace.",
        ],
        link: { label: "Open Billing", to: "/settings/billing" },
      },
    ],
  },
];

/** Support channels actually configured for this frontend. */
const SUPPORT: HelpSupport = {
  // No support address or request backend is connected to this frontend yet.
  email: null,
  canSubmitRequest: false,
  responseTime: null,
};

export function getHelp(accountType: AccountType): HelpResult {
  return {
    status: "ready",
    categories: CATEGORIES.filter(
      (category) => !category.accountTypes || category.accountTypes.includes(accountType),
    ),
    support: SUPPORT,
  };
}

/** Filters categories and articles by a free-text query. */
export function searchHelp(categories: HelpCategory[], rawQuery: string): HelpCategory[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return categories;
  return categories
    .map((category) => ({
      ...category,
      articles: category.articles.filter((article) =>
        [article.title, article.summary, ...article.body, category.label]
          .join(" ")
          .toLowerCase()
          .includes(query),
      ),
    }))
    .filter((category) => category.articles.length > 0);
}

export function countArticles(categories: HelpCategory[]): number {
  return categories.reduce((total, category) => total + category.articles.length, 0);
}
