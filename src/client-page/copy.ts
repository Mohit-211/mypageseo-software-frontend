import type { ComponentType } from "react";
import { BadgeCheck, Library, MapPinned, Star, Users } from "lucide-react";
import type { ClientReportType } from "./types";

/**
 * Plain-language copy for business owners reading their report. Written for someone who has never
 * used an SEO tool: what it shows, why it matters, and whether higher or lower is better.
 */

export const REPORT_META: Record<ClientReportType, { label: string; short: string; intro: string }> = {
  rank_tracker: {
    label: "Google Maps rankings",
    short: "Rankings",
    intro: "Where your business shows up when people nearby search Google Maps for what you offer. We search from many spots around you, the way real customers would.",
  },
  gbp_audit: {
    label: "Google Business Profile",
    short: "Profile",
    intro: "How complete and active your Google listing is, and how many people saw it and contacted you through it.",
  },
  competitor_analysis: {
    label: "Competitors",
    short: "Competitors",
    intro: "How your Google listing compares with the businesses customers see next to you.",
  },
  citation: {
    label: "Directory listings",
    short: "Listings",
    intro: "Your business on directories like Yelp and Bing. Matching name, address and phone everywhere helps Google trust your details.",
  },
  reputation: {
    label: "Reviews",
    short: "Reviews",
    intro: "What customers say about you on Google: your rating, new reviews, and the ones worth a reply.",
  },
};

export const REPORT_ICON: Record<ClientReportType, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  rank_tracker: MapPinned,
  gbp_audit: BadgeCheck,
  competitor_analysis: Users,
  citation: Library,
  reputation: Star,
};

export const EXPLAIN = {
  avgRank: "Your average position in Google Maps results across all the searches. 1 is the top spot, so lower is better.",
  top3: "How often you appear in the top 3, the businesses Google shows first, above the map. Higher is better.",
  found: "How often you appear anywhere in the first 60 results. Higher is better.",
  keywords: "The searches we track for you, like “dentist near me”.",
  change: "Compared with the previous update. Green means you moved up.",
  grid:
    "Each square is one Google Maps search made from that spot on the map; the middle square is your business. The number is where you ranked there. Green squares are where nearby customers find you first.",
  trend: "Your average position at each update. The line going up means you are climbing in the results.",
  movers: "The searches where your position changed the most since the previous update.",
  mapTop: "The businesses Google shows first for this search, from each spot around you. Yours is highlighted.",
  groups: "Your searches grouped by topic, with the average for each group.",
  score: "A 0–100 grade of how well your Google listing is set up and kept up to date. Higher is better.",
  pillars: "The score is built from these areas. Each shows how many of its checks are in good shape.",
  topFixes: "The changes that would improve your listing the most, in order.",
  checks: "Every item we check on your listing. Open one to see what it means and how to fix it.",
  views: "How many times your listing was shown on Google Search and Maps.",
  actions: "Calls, website visits, direction requests, messages and bookings that came from your listing.",
  per1000: "How many actions you get for every 1,000 times your listing is shown. It tells you how convincing your listing is.",
  searchTerms: "What people typed on Google before they found your listing (Google rounds small numbers).",
  competitorScore: "A 0–100 grade of each listing from what anyone can see on Google: rating, reviews, photos, hours, website and phone.",
  citationScore: "How many important directories list you correctly. Higher is better.",
  coverage: "The share of checked directories where you are listed.",
  nap: "Name, address and phone. When a directory shows different details than your Google listing, customers and Google get confused.",
  rating: "Your average star rating on Google.",
  replyRate: "The share of reviews you replied to. Replying shows customers you care, and Google notices.",
  needsAttention: "Recent reviews that are negative or mention a problem. A quick, polite reply helps.",
  themes: "What customers mention most often in their reviews, and whether it is good or bad.",
} as const;

/** Why a section of the report can't be shown. */
export function unavailableText(reason: string): string {
  switch (reason) {
    case "gbp_not_connected":
      return "Your Google Business Profile isn't connected yet.";
    case "no_gbp_report":
    case "not_synced_yet":
      return "Your Google data hasn't arrived yet. It will show in the next update.";
    case "v4_access_pending":
      return "Waiting for Google to grant access to this data.";
    case "no_rank_run":
      return "Your first rankings are being measured. They will show in the next update.";
    case "no_citations_yet":
      return "Your directory listings haven't been checked yet.";
    case "no_reviews":
      return "No reviews yet.";
    case "no_insights":
      return "Not enough reviews yet to find themes.";
    default:
      return "Not available in this update.";
  }
}
