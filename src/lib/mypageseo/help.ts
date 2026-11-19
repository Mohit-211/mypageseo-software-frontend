/**
 * Help content for the in-product help centre.
 *
 * There is no help-content backend connected to this frontend, so the articles
 * below are maintained as static product documentation. They describe what the
 * shipped screens actually do — nothing here promises functionality the product
 * does not have. When a content backend lands, replace `getHelp` with that read;
 * the types and the screen stay the same.
 *
 * Links use the short app addresses (`/keywords`, `/gbp/audit`, `/white-label#links`); the help
 * page turns location pages into the current location's address (`resolveAppLink`), so a click
 * goes straight to the page. `section` names a location page that has no short address.
 */

import type { Permission } from "./access";
import type { AccountType } from "./navigation";
import type { LocationSection } from "./section-links";

export type HelpCategoryId =
  | "getting_started"
  | "locations"
  | "keywords"
  | "rankings"
  | "gbp"
  | "reputation"
  | "ai"
  | "citations"
  | "competitors"
  | "reports"
  | "white_label"
  | "clients"
  | "account";

export type HelpLink = {
  label: string;
  /** App address; short location addresses are resolved to the current location. */
  to: string;
  /** A location page without a short address; used when a location is known, else `to`. */
  section?: LocationSection;
};

export type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  /** Short paragraphs or steps. Kept plain text so it can come from a CMS later. */
  body: string[];
  /** Existing product screen this article is about. */
  link?: HelpLink;
  /** Shown only to people who hold this permission (e.g. billing articles). */
  permission?: Permission;
};

export type HelpCategory = {
  id: HelpCategoryId;
  label: string;
  description: string;
  /** Agency-only categories are hidden from business accounts. */
  accountTypes?: AccountType[];
  /** Shown only to people who hold this permission. */
  permission?: Permission;
  /** Hidden from people who hold this permission (they have a better place for it). */
  hiddenWith?: Permission;
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
    description: "How MyPageSEO is organised and how to find your way around.",
    articles: [
      {
        id: "help_structure",
        title: "How MyPageSEO is organised",
        summary: "Locations, the location switcher, and the AI and Workspace sections.",
        body: [
          "Everything in MyPageSEO is about a location: one business on Google Maps. Rankings, keywords, your Google Business Profile (GBP), reviews, citations and competitors are shown for one location at a time.",
          "The location switcher in the sidebar shows which location you're looking at. Open it to search your locations, jump to another one or add a new one. On a phone, it's in the menu.",
          "Under the switcher are that location's pages: Overview, Keywords, Rankings, GBP, Reputation, Citations and Competitors. The AI section holds AI Studio, AI Posts, AI Review Replies and AI Settings.",
          "The Workspace section holds White Label and Clients for agencies, and Reports for businesses.",
        ],
        link: { label: "Open the dashboard", to: "/dashboard" },
      },
      {
        id: "help_onboarding",
        title: "Finish or revisit setup",
        summary: "What each setup step collects and how to resume it.",
        // Setup changes the workspace; read-only people (client users) can't use it.
        permission: "workspace.edit",
        body: [
          "Setup collects your business or agency details, connects Google, picks the profiles to track, and adds starting keywords and competitors.",
          "Your answers are kept as you move between steps, so you can go back without losing anything. Optional steps can be skipped and finished later.",
          "Once setup is finished, opening it again takes you straight to the dashboard.",
        ],
        link: { label: "Open setup", to: "/onboarding" },
      },
      {
        id: "help_search",
        title: "Find anything quickly",
        summary: "Search pages, locations and keywords from anywhere.",
        body: [
          "Press ⌘K (Ctrl+K on Windows) or use the search box at the top of every page to jump to a page, a location or a keyword.",
          "Use the arrow keys to move through the results, Enter to open one and Escape to close. Opening a location's page also switches the sidebar to that location.",
        ],
      },
    ],
  },
  {
    id: "locations",
    label: "Locations",
    description: "Add and manage the businesses you track.",
    articles: [
      {
        id: "help_locations_list",
        title: "Working with the Locations list",
        summary: "Search, filter, sort and open a location.",
        body: [
          "The Locations page lists every location you can access, with its average rank, profile score, rating and citation score.",
          "Search by name, filter by status (or by client, for agencies) and sort any column. Open a location to see its Overview; the sidebar switches to it.",
        ],
        link: { label: "Go to Locations", to: "/locations" },
      },
      {
        id: "help_add_location",
        title: "Add a location",
        summary: "Connect a Google Business Profile, or add a business from Google Maps.",
        body: [
          "Use Add location to connect a Google Business Profile, or to search Google Maps for a business whose profile you don't manage.",
          "Setup then asks for keywords and competitors, so the first ranking check can start.",
        ],
        link: { label: "Add a location", to: "/locations/add" },
      },
      {
        id: "help_location_states",
        title: "Location states",
        summary: "What Active, Needs setup, No Google profile and the other states mean.",
        body: [
          "Active: tracking and Google data are up to date.",
          "Needs setup: add keywords and competitors so tracking can start.",
          "No Google profile: rankings and citations work; connect its Google Business Profile for reviews, posts and profile insights.",
          "Profile disconnected: rankings keep working, but profile data, reviews and posts no longer update.",
          "Reconnect Google: Google refused the stored access, so profile data stopped. Reconnect it from Integrations.",
        ],
        link: { label: "Open Integrations", to: "/settings/integrations" },
      },
    ],
  },
  {
    id: "keywords",
    label: "Keywords",
    description: "The searches you track. Rankings, AI posts and AI replies use them.",
    articles: [
      {
        id: "help_keywords",
        title: "Your keywords",
        summary: "What keywords are for and how to add them.",
        body: [
          "Keywords are the searches you want to be found for, such as \"dentist near me\". Each location tracks up to 20.",
          "Rank tracking measures where you appear for them, and AI Posts and AI Review Replies use them so your posts and replies mention what you want to be found for.",
          "Add keywords yourself, or track a search people really used: GBP Overview lists them with a Track button.",
        ],
        link: { label: "Open Keywords", to: "/keywords" },
      },
      {
        id: "help_keyword_groups",
        title: "Keyword groups",
        summary: "Group keywords by service or area to read them faster.",
        body: [
          "Groups collect related keywords, such as a service or a neighbourhood, so you can see how a theme performs instead of scanning every keyword.",
          "Rankings and reports use the same groups, so they stay consistent.",
        ],
        link: { label: "Open keyword groups", to: "/keywords#groups" },
      },
    ],
  },
  {
    id: "rankings",
    label: "Rankings",
    description: "Where you show up on Google Maps for your keywords.",
    articles: [
      {
        id: "help_rank_tracker",
        title: "Rank Tracker",
        summary: "Your position for each keyword and how it changed.",
        body: [
          "Rank Tracker shows your position for each keyword from 5 spots around your business, and how it changed since the last check.",
          "When you're not in the top 60, it shows 60+ instead of a made-up number.",
          "Rankings are checked automatically every month. You can refresh sooner with tokens.",
        ],
        link: { label: "Open Rank Tracker", to: "/rankings/tracker" },
      },
      {
        id: "help_grid",
        title: "Map Rankings and the Local Search Grid",
        summary: "See how your position changes across the area.",
        body: [
          "Map Rankings shows who ranks at one search spot, with you and your competitors marked.",
          "The Local Search Grid checks your position across a grid of points around the business, so you can see how far your reach goes.",
        ],
        link: { label: "Open Local Search Grid", to: "/rankings/local-search-grid" },
      },
    ],
  },
  {
    id: "gbp",
    label: "GBP",
    description: "Your Google Business Profile: performance, audit, comparison and posts.",
    articles: [
      {
        id: "help_gbp_overview",
        title: "GBP Overview",
        summary: "Profile views, customer actions and the searches that find you.",
        body: [
          "GBP Overview shows how often your profile was seen on Google Maps and Search, and how many people called, visited your website or asked for directions, compared with the period before.",
          "It also lists the searches people used to find you. Track any of them as a keyword with one click.",
        ],
        link: { label: "Open GBP Overview", to: "/gbp" },
      },
      {
        id: "help_gbp_audit",
        title: "Reading the GBP Audit",
        summary: "Your profile score and the fixes worth the most points.",
        body: [
          "The profile score (0–100) checks how complete, active and well-reviewed your profile is. Grades: A 85+, B 70+, C 55+, D 40+.",
          "Improve first lists the fixes worth the most points. Each one has a button that takes you where to fix it: Google for profile details and photos, Posts for activity, and AI Review Replies for replies.",
        ],
        link: { label: "Open GBP Audit", to: "/gbp/audit" },
      },
      {
        id: "help_profile_comparison",
        title: "Profile Comparison",
        summary: "Your public Google details next to nearby businesses.",
        body: [
          "Profile Comparison puts your rating, reviews, photos, hours, website and phone next to nearby businesses, and points out the biggest gaps.",
          "It uses public Google data, so it works even before you connect your profile.",
        ],
        link: { label: "Open Profile Comparison", to: "/gbp/competitors" },
      },
      {
        id: "help_posts",
        title: "Google posts",
        summary: "Write, schedule and publish posts to your profile.",
        body: [
          "Posts lists what needs you first, then what's scheduled and what's live on your profile. Write a post yourself or with AI, add a photo, and publish now or later.",
          "AI posts that wait for someone's approval are also gathered on Posts to review, for every location at once.",
          "Posting needs the location's Google connection.",
        ],
        link: { label: "Open Posts", to: "/gbp/posts", section: "gbp/posts" },
      },
    ],
  },
  {
    id: "reputation",
    label: "Reputation",
    description: "Your reviews, your replies and what customers say.",
    articles: [
      {
        id: "help_reviews",
        title: "Reviews and replies",
        summary: "Find the reviews that need a reply and answer them.",
        body: [
          "Reputation lists your Google reviews, newest first. Filter for the ones that still need a reply, reply in place, or draft replies with AI.",
          "Replying needs the location's Google connection.",
        ],
        link: { label: "Open Reviews", to: "/reputation" },
      },
      {
        id: "help_insights",
        title: "Review insights",
        summary: "What customers praise and complain about, summed up by AI.",
        body: ["Review insights groups what customers mention most, good and bad, so you know what to keep doing and what to fix.", "Each update uses tokens."],
        link: { label: "Open Review insights", to: "/reputation/insights" },
      },
    ],
  },
  {
    id: "ai",
    label: "AI",
    description: "AI Studio, AI Posts, AI Review Replies and AI Settings.",
    articles: [
      {
        id: "help_ai_studio",
        title: "AI Studio",
        summary: "Every AI feature in one place, with what it costs.",
        body: [
          "AI Studio is the home of MyPageSEO's AI features: writing posts, drafting review replies, review insights and keyword ideas, each with what it costs.",
          "Get the AI ready lists what helps it write about your business: your facts, your signature, your logo and your own photos.",
          "If AI shows as almost ready, it's being switched on for your account. You can still write posts and replies yourself in the meantime.",
        ],
        link: { label: "Open AI Studio", to: "/ai" },
      },
      {
        id: "help_ai_posts",
        title: "AI Posts",
        summary: "Let AI write and schedule posts that sound like you.",
        body: [
          "AI Posts keeps a list of post ideas for each location, planned from your services, facts, season and area, and writes each post from your own facts and keywords. Every post is saved as a draft: check it, change it, then schedule or publish it.",
          "A post can take a few minutes to write. You can leave the page meanwhile; it shows up when it's ready.",
          "Auto-posting writes posts on a schedule. By default, each one waits for your review before it goes out.",
          "Post ideas are free. Writing a post and making an AI image cost tokens; photos from your library are free. Settings › Billing lists the prices.",
        ],
        link: { label: "Open AI Posts", to: "/ai/posts" },
      },
      {
        id: "help_ai_replies",
        title: "AI Review Replies",
        summary: "Draft replies to many reviews at once.",
        body: [
          "AI Review Replies drafts a reply to each review you pick, about what the reviewer said. Nothing is sent until you approve it, and you can edit every draft first.",
          "AI replies are bought in blocks of 10 for each location, and the ones left stay with it. Settings › Billing shows the price and what each location has left.",
        ],
        link: { label: "Open AI Review Replies", to: "/ai/replies" },
      },
      {
        id: "help_ai_settings",
        title: "AI Settings and facts for the AI",
        summary: "House rules, signature, contact line, restricted mode, and the facts the AI may use.",
        body: [
          "AI Settings, in the AI section of each location, sets how the AI writes for that business. House rules are standing instructions, like “Never mention prices”. The signature and the contact line are used in AI review replies.",
          "Restricted mode is on by default for health, legal, financial, insurance and tax businesses: replies name no one, repeat nothing from the review, name no service and use no keywords. Only the account owner can switch it off.",
          "Facts for the AI are your own facts, offers, events and contests. Prices, percentages, offer dates and staff names in AI posts and replies come only from there.",
          "AI Settings also holds your logo and how AI pictures look, and links to your photo library.",
        ],
        link: { label: "Open AI Settings", to: "/ai/settings" },
      },
    ],
  },
  {
    id: "citations",
    label: "Citations",
    description: "Your directory listings, checked by the MyPageSEO team.",
    articles: [
      {
        id: "help_citation_states",
        title: "Citation states",
        summary: "Live & correct, wrong details, not listed, duplicate and in progress.",
        body: [
          "Live & correct: the listing shows the right name, address and phone.",
          "Wrong details: the listing exists but a detail is wrong. The table shows what it says and what it should say.",
          "Not listed: there's no listing on that directory. Duplicate: more than one listing was found, which splits your signals.",
          "Submitted and Pending approval: the listing is on its way. Not checked yet: our team hasn't checked it yet.",
        ],
        link: { label: "Open Citations", to: "/citations" },
      },
      {
        id: "help_nap",
        title: "Why consistent details matter",
        summary: "Matching name, address and phone help Google trust your business.",
        body: [
          "Google cross-checks your name, address and phone (often called NAP) across directories. Conflicting details make it less sure about your business.",
          "The MyPageSEO team checks every listing by hand. Questions about a listing? Open a support ticket.",
        ],
        // `?new=1` opens the new-ticket form straight away.
        link: { label: "Contact support", to: "/support?new=1" },
      },
    ],
  },
  {
    id: "competitors",
    label: "Competitors",
    description: "How you rank against nearby businesses.",
    articles: [
      {
        id: "help_competitors",
        title: "Competitor rankings",
        summary: "Who ranks above you, keyword by keyword.",
        body: [
          "Competitors shows, keyword by keyword, where nearby businesses rank against you, from the same ranking checks.",
          "Track up to 5 competitors per location. Add a business you spot on Map Rankings or Profile Comparison with its Track button.",
        ],
        link: { label: "Open Competitors", to: "/competitors" },
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    description: "PDF reports and the monthly emails that send them.",
    // Agency staff make reports on White Label (its own category below).
    hiddenWith: "clients.view",
    articles: [
      {
        id: "help_report_types",
        title: "Report types",
        // The names the create dialog and the reports list use (REPORT_TYPES in report-meta.ts).
        summary: "Rank Tracker report, GBP Audit report, Competitor Analysis, Citation report, Reputation report and Full report.",
        body: [
          "Each report covers one location and one period, built from the same data as the pages. The Full report combines them all.",
          "Reports are usually ready in under a minute. Download, email or share them from Reports.",
        ],
        link: { label: "Open Reports", to: "/reports" },
      },
      {
        id: "help_schedules",
        title: "Monthly emails",
        summary: "A fresh PDF report emailed every month, and what to check when one doesn't arrive.",
        body: [
          "A monthly email sends a fresh PDF report to the people you choose, right after each location's monthly refresh.",
          "If one doesn't arrive, check that the monthly email is active and the location's Google connection: a disconnected profile stops its data.",
        ],
        link: { label: "Open monthly emails", to: "/reports#schedules" },
      },
    ],
  },
  {
    id: "white_label",
    label: "White Label",
    description: "Your brand, client links and branded reports, all on one page.",
    accountTypes: ["agency"],
    permission: "clients.view",
    articles: [
      {
        id: "help_white_label_brand",
        title: "Set up your brand",
        summary: "Your logo, colours and company name on everything clients see.",
        body: ["Add your logo, colours and company name once. Client links and branded reports use them.", "Only the account owner can change the brand."],
        link: { label: "Open your brand", to: "/white-label#brand" },
      },
      {
        id: "help_client_links",
        title: "Client links",
        summary: "A branded page per location, ready to send to your client.",
        body: [
          "Each location can have a branded page for your client with the reports you choose. Create the link, copy it and send it; the page keeps itself up to date.",
        ],
        link: { label: "Open client links", to: "/white-label#links" },
      },
      {
        id: "help_branded_reports",
        title: "Branded PDF reports and monthly emails",
        summary: "PDF reports with your brand, and a fresh one emailed to clients every month.",
        body: [
          "PDF reports and monthly emails live on White Label, in step 3, under your brand and client links.",
          "Make a PDF report there, then download, share or email it without leaving the page. It carries your brand.",
          "A monthly email sends a fresh PDF to the people you choose, right after each location's monthly refresh.",
        ],
        link: { label: "Open PDF reports", to: "/white-label#reports" },
      },
    ],
  },
  {
    id: "clients",
    label: "Clients",
    description: "Group locations by the business they belong to.",
    accountTypes: ["agency"],
    permission: "clients.view",
    articles: [
      {
        id: "help_clients",
        title: "Clients and their locations",
        summary: "What clients are for and who client users are.",
        body: [
          "A client groups the locations of one business you work for. Clients are optional; they keep reports, client links and access organised.",
          "Client users are people at a client who get a read-only view of their own locations and reports.",
        ],
        link: { label: "Open Clients", to: "/clients" },
      },
    ],
  },
  {
    id: "account",
    label: "Account & billing",
    description: "Your profile, team, Google connection, billing and tokens.",
    articles: [
      {
        id: "help_google_connection",
        title: "Google Business Profile connection",
        summary: "What the connection is used for and when to reconnect.",
        permission: "integrations.manage",
        body: [
          "Connecting Google lets MyPageSEO read each profile's details, performance, reviews and posts, and publish the replies and posts you approve.",
          "If a location shows Reconnect Google, Google refused the stored access. Reconnect from Integrations to restart its data.",
        ],
        link: { label: "Open Integrations", to: "/settings/integrations" },
      },
      {
        id: "help_team",
        title: "Your team",
        summary: "Seats, members and client users.",
        permission: "team.view",
        body: [
          "Each paid location includes 3 users, shared across the team and the owner included.",
          "Members work on everything except settings, the team and billing. Client users (agencies) only see their own clients' locations and reports.",
        ],
        link: { label: "Open Team", to: "/settings/team" },
      },
      {
        id: "help_tokens",
        title: "Tokens",
        summary: "What tokens pay for and how to get more.",
        permission: "billing.view",
        body: [
          "Tokens pay for manual refreshes and AI actions; the automatic monthly refresh is free.",
          "Settings › Billing shows your balance, what each action costs, the AI replies and analyses each location has left, recent activity and the packs you can buy.",
        ],
        link: { label: "See tokens", to: "/settings/billing#tokens" },
      },
      {
        id: "help_billing",
        title: "Subscription and invoices",
        summary: "Your plan, renewals and invoices.",
        permission: "billing.view",
        body: [
          "Billing shows your plan, the locations and users it includes, the next renewal and every invoice.",
          "You pay with PayPal and come straight back to MyPageSEO when it's done.",
        ],
        link: { label: "Open Billing", to: "/settings/billing" },
      },
      {
        id: "help_profile",
        title: "Your profile and password",
        summary: "Change your name, phone and password.",
        body: ["Change your name, phone and password in Settings › Profile.", "To change your sign-in email, open a support ticket."],
        link: { label: "Open Profile", to: "/settings/profile" },
      },
      {
        id: "help_notifications",
        title: "Notifications",
        summary: "What MyPageSEO emails you today.",
        body: [
          "Notification settings are on the way. Today, MyPageSEO emails you about your account (verification, password resets and invitations), your monthly report emails and replies to your support tickets.",
        ],
      },
    ],
  },
];

/** Support channels actually configured for this frontend. */
const SUPPORT: HelpSupport = {
  // No support address is configured; tickets (`/support`) are the way to reach the team.
  email: null,
  canSubmitRequest: true,
  responseTime: null,
};

/**
 * The help centre for this account: categories for its account type, without what the person
 * can't open (`can` answers permission checks; everything is shown when it's omitted).
 */
export function getHelp(accountType: AccountType, can: (permission: Permission) => boolean = () => true): HelpResult {
  const visible = (item: { permission?: Permission }) => !item.permission || can(item.permission);
  return {
    status: "ready",
    categories: CATEGORIES.filter(
      (category) =>
        (!category.accountTypes || category.accountTypes.includes(accountType)) && visible(category) && !(category.hiddenWith && can(category.hiddenWith)),
    )
      .map((category) => ({ ...category, articles: category.articles.filter(visible) }))
      .filter((category) => category.articles.length > 0),
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
        [article.title, article.summary, ...article.body, category.label].join(" ").toLowerCase().includes(query),
      ),
    }))
    .filter((category) => category.articles.length > 0);
}

export function countArticles(categories: HelpCategory[]): number {
  return categories.reduce((total, category) => total + category.articles.length, 0);
}
