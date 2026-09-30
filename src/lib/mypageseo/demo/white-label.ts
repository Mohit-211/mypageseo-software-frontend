/**
 * Demo white-label data for the agency workspace ("ABC Digital Marketing").
 *
 * Consumed only by `src/lib/white-label/white-label.ts`, which swaps these for
 * API responses once the branding, domain and client report services exist.
 */
import { subDays, subHours } from "date-fns";
import type {
  AgencyBranding,
  AgencyClient,
  ClientReport,
  DomainSettings,
  EmailBranding,
  ReportAccessSettings,
  ReportModule,
  ReportPreviewData,
} from "../../white-label/white-label";
import { pickInt, rng, seedFrom } from "./demo-mode";

/** Simple logo mark so the demo has a real logo image to preview and replace. */
const DEMO_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="64" viewBox="0 0 112 64">
<rect x="0" y="4" width="112" height="56" rx="12" fill="#123C69"/>
<text x="56" y="41" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" letter-spacing="2" fill="#fff">ABC</text>
<rect x="36" y="47" width="40" height="4" rx="2" fill="#E8743B"/>
</svg>`;

const DEMO_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#123C69"/>
<path d="M18 48 L32 16 L46 48" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="47" cy="17" r="6" fill="#E8743B"/>
</svg>`;

const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** URL segment identifying the agency on the shared white-label domain. */
export const DEMO_AGENCY_SLUG = "abc-digital";

export const DEMO_AGENCY_BRANDING: AgencyBranding = {
  agencyName: "ABC Digital Marketing",
  logoUrl: svgDataUrl(DEMO_LOGO_SVG),
  logoFileName: "abc-digital-logo.svg",
  faviconUrl: svgDataUrl(DEMO_FAVICON_SVG),
  faviconFileName: "abc-favicon.svg",
  primaryColor: "#123C69",
  secondaryColor: "#EEF2F7",
  accentColor: "#E8743B",
  buttonStyle: "medium",
  font: "plex",
  footerText: "ABC Digital Marketing",
  contactEmail: "agency@example.com",
  website: "https://example.com",
  hidePlatformBranding: true,
};

export const DEMO_DEFAULT_DOMAIN = "googleprofile.report";

export function demoDomainSettings(): DomainSettings {
  return {
    defaultDomain: DEMO_DEFAULT_DOMAIN,
    defaultDomainStatus: "connected",
    customDomain: null,
  };
}


const CLIENTS: { name: string; category: string; city: string }[] = [
  { name: "XYZ Restaurant", category: "Restaurant", city: "Austin, TX" },
  { name: "ABC Beauty Studio", category: "Beauty Salon", city: "Austin, TX" },
  { name: "Lakeside Dental Care", category: "Dentist", city: "Round Rock, TX" },
  { name: "Summit Roofing Co.", category: "Roofing Contractor", city: "Cedar Park, TX" },
  { name: "Bright Paws Veterinary", category: "Veterinarian", city: "Austin, TX" },
  { name: "Harbor Yoga Collective", category: "Yoga Studio", city: "Georgetown, TX" },
  { name: "Maple Street Bakery", category: "Bakery", city: "Pflugerville, TX" },
  { name: "Iron Forge Fitness", category: "Gym", city: "Austin, TX" },
  { name: "Greenleaf Landscaping", category: "Landscaper", city: "Leander, TX" },
  { name: "Northside Auto Repair", category: "Auto Repair Shop", city: "Austin, TX" },
  { name: "Clearview Optometry", category: "Optometrist", city: "Round Rock, TX" },
  { name: "Riverbend Law Group", category: "Law Firm", city: "Austin, TX" },
  { name: "Sunrise Pediatrics", category: "Pediatrician", city: "Cedar Park, TX" },
  { name: "Copperline Coffee", category: "Coffee Shop", city: "Austin, TX" },
  { name: "Evergreen Plumbing", category: "Plumber", city: "Georgetown, TX" },
  { name: "Luxe Nail Lounge", category: "Nail Salon", city: "Austin, TX" },
  { name: "Pinecrest Realty", category: "Real Estate Agency", city: "Leander, TX" },
  { name: "Blue Door Bistro", category: "Restaurant", city: "Austin, TX" },
  { name: "Solace Massage Therapy", category: "Massage Therapist", city: "Round Rock, TX" },
  { name: "Keystone HVAC", category: "HVAC Contractor", city: "Pflugerville, TX" },
  { name: "Willow Creek Florist", category: "Florist", city: "Austin, TX" },
  { name: "Atlas Chiropractic", category: "Chiropractor", city: "Cedar Park, TX" },
  { name: "Golden Hour Photography", category: "Photographer", city: "Austin, TX" },
  { name: "Trailhead Outfitters", category: "Outdoor Store", city: "Georgetown, TX" },
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** XYZ Restaurant and ABC Beauty Studio keep the short slugs used in the examples. */
const SLUG_OVERRIDES: Record<string, string> = {
  "ABC Beauty Studio": "abc-beauty",
};

export const DEMO_AGENCY_CLIENTS: AgencyClient[] = CLIENTS.map((client, i) => ({
  id: `wl_client_${i + 1}`,
  name: client.name,
  slug: SLUG_OVERRIDES[client.name] ?? slugify(client.name),
  category: client.category,
  city: client.city,
}));

const MODULE_SETS: ReportModule[][] = [
  ["gbp", "ai_visibility", "reviews", "posts"],
  ["gbp", "reviews", "posts"],
  ["gbp", "ai_visibility", "reviews"],
  ["gbp", "reviews", "seo"],
];

/**
 * 20 of the 24 clients have a report: 18 published (all agency-branded),
 * one draft and one disabled, so every status is represented.
 */
export function demoClientReports(now = new Date()): ClientReport[] {
  // Most recently updated first; XYZ Restaurant and ABC Beauty Studio lead the list.
  const order = [1, 0, ...Array.from({ length: 18 }, (_, i) => i + 2)];
  return order.map((clientIndex, position) => {
    const client = DEMO_AGENCY_CLIENTS[clientIndex]!;
    const seed = seedFrom("wl-report", client.id);
    const status = position === 18 ? "draft" : position === 19 ? "disabled" : "published";
    const updatedAt = subHours(subDays(now, 1 + Math.floor(position / 2)), pickInt(seed, 1, 9)).toISOString();
    return {
      id: `wl_report_${client.id}`,
      clientId: client.id,
      status,
      modules: MODULE_SETS[clientIndex % MODULE_SETS.length]!,
      visibility: position % 5 === 3 ? "password" : "public",
      branding: status === "draft" ? "default" : "agency",
      createdAt: subDays(new Date(updatedAt), 30 + pickInt(seed + 1, 0, 60)).toISOString(),
      updatedAt,
    };
  });
}

export const DEMO_REPORT_ACCESS: ReportAccessSettings = {
  visibility: "public",
  expiration: "never",
  customExpiresOn: null,
  allowDownload: true,
  allowClientSharing: false,
};

export const DEMO_EMAIL_BRANDING: EmailBranding = {
  senderName: "ABC Digital Marketing",
  senderEmail: "reports@abcmarketing.com",
  logoUrl: null,
  logoFileName: null,
  footer: "Your monthly marketing report is ready.",
};

const POST_TITLES = [
  "Fall menu is here — try our seasonal specials",
  "Behind the scenes with our team",
  "Weekend offer: 15% off for first-time visitors",
  "Customer spotlight of the month",
  "New hours starting October",
  "Thank you for 500 five-star reviews",
];

const REVIEW_SNIPPETS = [
  "Friendly staff and the service was quick. Will definitely be back!",
  "Great experience from start to finish — highly recommend.",
  "Clean, welcoming and professional. Booking online was easy.",
  "Consistently excellent. The team really cares about customers.",
];

const REVIEWERS = ["Maria G.", "Daniel K.", "Priya S.", "Tom W.", "Aisha R.", "Chris L."];

/** Deterministic monthly report numbers for one client. */
export function demoReportPreview(client: AgencyClient, now = new Date()): ReportPreviewData {
  const random = rng(seedFrom("wl-preview", client.id));
  const between = (min: number, max: number) => Math.round(min + random() * (max - min));
  const change = (min: number, max: number) => Math.round((min + random() * (max - min)) * 10) / 10;

  const rating = Math.round((4.3 + random() * 0.6) * 10) / 10;
  const totalReviews = between(140, 620);
  const fiveStarShare = 0.55 + random() * 0.25;
  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const share = stars === 5 ? fiveStarShare : stars === 4 ? (1 - fiveStarShare) * 0.62 : stars === 3 ? (1 - fiveStarShare) * 0.2 : stars === 2 ? (1 - fiveStarShare) * 0.1 : (1 - fiveStarShare) * 0.08;
    return { stars, count: Math.round(totalReviews * share) };
  });

  const baseViews = between(2400, 9800);
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { month: date.toISOString(), views: Math.round(baseViews * (0.72 + i * 0.06 + random() * 0.08)) };
  });

  const postsPublished = between(8, 16);

  return {
    clientId: client.id,
    periodStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    rating,
    ratingChange: change(-0.1, 0.2),
    totalReviews,
    newReviews: between(12, 48),
    responseRate: between(82, 100),
    ratingDistribution: distribution,
    aiScore: between(58, 88),
    aiScoreChange: change(-3, 9),
    aiPlatforms: [
      { platform: "ChatGPT", visibility: between(45, 90) },
      { platform: "Gemini", visibility: between(35, 85) },
      { platform: "Perplexity", visibility: between(30, 80) },
      { platform: "Claude", visibility: between(25, 75) },
    ],
    aiMentions: between(18, 64),
    gbp: {
      views: months[months.length - 1]!.views,
      viewsChange: change(-4, 22),
      calls: between(60, 320),
      callsChange: change(-6, 18),
      directions: between(90, 540),
      directionsChange: change(-5, 25),
      websiteClicks: between(120, 780),
      websiteClicksChange: change(-3, 20),
    },
    monthlyViews: months,
    postsPublished,
    postViews: between(1800, 7200),
    postClicks: between(90, 480),
    topPosts: POST_TITLES.slice(0, 3).map((title, i) => ({
      id: `${client.id}_post_${i}`,
      title,
      publishedAt: subDays(now, 4 + i * 7).toISOString(),
      views: between(300, 1600),
      clicks: between(12, 120),
    })),
    recentReviews: REVIEW_SNIPPETS.slice(0, 2).map((text, i) => ({
      id: `${client.id}_review_${i}`,
      author: REVIEWERS[between(0, REVIEWERS.length - 1)]!,
      rating: i === 0 ? 5 : between(4, 5),
      text,
      createdAt: subDays(now, 2 + i * 5).toISOString(),
    })),
    seo: {
      trackedKeywords: between(25, 80),
      top3Keywords: between(6, 22),
      averagePosition: Math.round((3 + random() * 6) * 10) / 10,
      averagePositionChange: change(-1.5, 0.6),
    },
  };
}
