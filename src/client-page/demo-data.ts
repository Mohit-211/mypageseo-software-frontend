import type { ClientPageData, RtGrid } from "./types";

/**
 * Sample data for `/demo` in development only (never in a production build: `data.ts` loads it behind
 * `import.meta.env.DEV`). Shaped like `GET <page>/data`; the older editions are slightly worse.
 */

const EDITIONS = [
  { key: "20261003-0302", generated_at: "2026-10-03T03:02:40.000Z" },
  { key: "20260903-0301", generated_at: "2026-09-03T03:01:12.000Z" },
  { key: "20260803-0305", generated_at: "2026-08-03T03:05:51.000Z" },
];

/** A deterministic 0–1 noise for stable grids. */
const noise = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

function grid(keyword: string, seed: number, shift: number): RtGrid {
  const size = 7;
  const center = 3;
  const cells: RtGrid["cells"] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const distance = Math.hypot(row - center, col - center);
      const raw = Math.round(1 + distance * (2.2 + seed) + noise(seed * 100 + row * 7 + col) * 6 + shift);
      if (raw > 60) cells.push({ row, col, rank: null, status: "not_found" });
      else cells.push({ row, col, rank: Math.max(1, raw), status: "ok" });
    }
  }
  const ranks = cells.map((cell) => cell.rank ?? 61);
  return {
    keyword,
    size,
    spacing_km: 0.8,
    cells,
    avg_rank: Number((ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1)),
    found_rate: cells.filter((cell) => cell.status === "ok").length / cells.length,
    top3_rate: cells.filter((cell) => (cell.rank ?? 99) <= 3).length / cells.length,
  };
}

export function demoPage(edition: string | null): ClientPageData {
  const index = Math.max(0, EDITIONS.findIndex((entry) => entry.key === edition));
  const current = EDITIONS[index]!;
  const shift = index * 2;
  const grids = [grid("dentist near me", 0.6, shift), grid("emergency dentist", 1.4, shift), grid("teeth whitening toronto", 2.4, shift)];
  const days = Array.from({ length: 28 }, (_, i) => {
    const date = new Date(Date.UTC(2026, 8, 5 + i));
    const weekend = [0, 6].includes(date.getUTCDay());
    const impressions = Math.round((weekend ? 140 : 210) + noise(i + 3) * 60 - shift * 6);
    return {
      date: date.toISOString().slice(0, 10),
      impressions,
      maps: Math.round(impressions * 0.64),
      search: Math.round(impressions * 0.36),
      actions: Math.round(impressions * 0.07),
      calls: Math.round(impressions * 0.03),
      website_clicks: Math.round(impressions * 0.025),
      direction_requests: Math.round(impressions * 0.015),
    };
  });
  const sum = (key: keyof (typeof days)[number]) => days.reduce((total, day) => total + (day[key] as number), 0);

  return {
    branding: {
      name: "Northern Local SEO",
      website_url: "https://northernlocalseo.example",
      contact_text: "hello@northernlocalseo.example · (416) 555-0199",
      footer_text: "Northern Local SEO · Toronto, ON",
      primary_color: "#0f766e",
      secondary_color: "#b45309",
      logo_url: null,
    },
    location: { name: "Maple Leaf Dental", address: "120 King St W", city: "Toronto", state: "ON", country: "Canada" },
    edition: current,
    latest_key: EDITIONS[0]!.key,
    editions: EDITIONS,
    reports: ["rank_tracker", "gbp_audit", "competitor_analysis", "citation", "reputation"],
    attribution: "Business names, ratings and reviews: Google Maps",
    data: {
      rank_tracker: {
        available: true,
        run: { run_at: current.generated_at, finished_at: current.generated_at, partial: false, grid_size: 7, spacing_km: 0.8 },
        summary: { overall_avg_rank: 6.4 + shift, change: index === 2 ? null : 1.8, top3_rate: 0.38 - index * 0.05, found_rate: 0.94 - index * 0.03, keywords: 6 },
        keywords: [
          { keyword: "dentist near me", avg_rank: 3.2 + shift, found_rate: 1, top3_rate: 0.62, change: 2.1, label: "improved" },
          { keyword: "emergency dentist", avg_rank: 5.8 + shift, found_rate: 0.98, top3_rate: 0.41, change: 1.4, label: "improved" },
          { keyword: "teeth whitening toronto", avg_rank: 9.6 + shift, found_rate: 0.9, top3_rate: 0.18, change: -1.2, label: "declined" },
          { keyword: "dental implants", avg_rank: 12.4 + shift, found_rate: 0.82, top3_rate: 0.06, change: 0.4, label: null },
          { keyword: "family dentist", avg_rank: 4.1 + shift, found_rate: 1, top3_rate: 0.55, change: 3.3, label: "improved" },
          { keyword: "invisalign toronto", avg_rank: 21.7 + shift, found_rate: 0.61, top3_rate: 0, change: null, label: "entered" },
        ],
        history: [
          { run_at: "2026-05-03T03:00:00.000Z", overall_avg_rank: 13.1 },
          { run_at: "2026-06-03T03:00:00.000Z", overall_avg_rank: 11.6 },
          { run_at: "2026-07-03T03:00:00.000Z", overall_avg_rank: 10.2 },
          ...EDITIONS.slice(index)
            .reverse()
            .map((entry, i, list) => ({ run_at: entry.generated_at, overall_avg_rank: Number((6.4 + (list.length - 1 - i) * 2 + index * 2).toFixed(1)) })),
        ],
        grid: grids,
        movers: {
          improved: [
            { keyword: "family dentist", change: 3.3 },
            { keyword: "dentist near me", change: 2.1 },
          ],
          declined: [{ keyword: "teeth whitening toronto", change: -1.2 }],
          entered: ["invisalign toronto"],
          dropped: [],
        },
        map_ranking: [
          {
            keyword: "dentist near me",
            points: ["C", "N", "E", "S", "W"].map((point, i) => ({
              point,
              self_rank: i === 3 ? 7 : i + 1,
              top: [
                { rank: 1, name: i === 0 ? "Maple Leaf Dental" : "King West Dental Studio", is_self: i === 0 },
                { rank: 2, name: i === 1 ? "Maple Leaf Dental" : "Downtown Smiles", is_self: i === 1 },
                { rank: 3, name: i === 2 ? "Maple Leaf Dental" : "Queen Street Dentistry", is_self: i === 2 },
                { rank: 4, name: "Bay Street Dental Care", is_self: false },
                { rank: 5, name: i === 4 ? "Maple Leaf Dental" : "Union Station Dental", is_self: i === 4 },
              ],
            })),
          },
        ],
        keyword_groups: [
          { name: "General dentistry", keywords: ["dentist near me", "family dentist"], avg_rank: 3.6 + shift, top3_rate: 0.58, found_rate: 1, change: 2.7, comparable_keywords: 2 },
          { name: "Cosmetic", keywords: ["teeth whitening toronto", "invisalign toronto"], avg_rank: 15.6 + shift, top3_rate: 0.09, found_rate: 0.76, change: -1.2, comparable_keywords: 1 },
          { name: "Urgent care", keywords: ["emergency dentist"], avg_rank: 5.8 + shift, top3_rate: 0.41, found_rate: 0.98, change: 1.4, comparable_keywords: 1 },
        ],
      },
      gbp_audit: {
        available: true,
        generated_at: current.generated_at,
        range: "28d",
        v4_enabled: true,
        score: {
          score: 78 - index * 4,
          grade: index ? "C" : "B",
          partial: false,
          version: 2,
          counts: { pass: 14, partial: 4, fail: 2, not_available: 1 },
          excluded_pillars: [],
          pillars: [
            { id: "completeness", weight: 0.4, score: 88, available: true, state: "pass", counts: { pass: 8, partial: 1, fail: 0, not_available: 0 } },
            { id: "activity", weight: 0.2, score: 52, available: true, state: "partial", counts: { pass: 1, partial: 2, fail: 1, not_available: 0 } },
            { id: "reviews", weight: 0.25, score: 81, available: true, state: "pass", counts: { pass: 4, partial: 1, fail: 0, not_available: 0 } },
            { id: "performance", weight: 0.15, score: 70, available: true, state: "partial", counts: { pass: 1, partial: 0, fail: 1, not_available: 1 } },
          ],
        },
        checks: {
          checks: [
            { label: "Profile is verified", pillar: "completeness", status: "ok", state: "pass", points: 10, max: 10, detail: "Google has verified this business.", fix_hint: null, why_it_matters: "Unverified listings rank lower and can be edited by anyone." },
            { label: "Description is detailed", pillar: "completeness", status: "ok", state: "pass", points: 6, max: 6, detail: "612 characters describing services and the area served.", fix_hint: null, why_it_matters: "A clear description helps Google match you to more searches." },
            { label: "Services are listed", pillar: "completeness", status: "partial", state: "partial", points: 3, max: 6, detail: "4 services listed; similar clinics list 10 or more.", fix_hint: "Add every treatment you offer, with a short description.", why_it_matters: "Services help Google show you for specific treatments." },
            { label: "Posted in the last 7 days", pillar: "activity", status: "fail", state: "fail", points: 0, max: 6, detail: "The last post was 23 days ago.", fix_hint: "Share a short update or offer every week.", why_it_matters: "Regular posts show Google and customers the business is active." },
            { label: "New photos this month", pillar: "activity", status: "partial", state: "partial", points: 2, max: 5, detail: "2 photos added in the last 30 days.", fix_hint: "Add photos of the team, the office and recent work.", why_it_matters: "Listings with fresh photos get more clicks." },
            { label: "Replies to reviews", pillar: "reviews", status: "ok", state: "pass", points: 8, max: 8, detail: "92% of reviews in the last 90 days have a reply.", fix_hint: null, why_it_matters: "Replying builds trust with people reading your reviews." },
            { label: "Steady flow of new reviews", pillar: "reviews", status: "partial", state: "partial", points: 4, max: 6, detail: "11 new reviews in 90 days.", fix_hint: "Ask happy patients for a review after their visit.", why_it_matters: "Recent reviews weigh more in Google's ranking." },
            { label: "Calls from the listing", pillar: "performance", status: "fail", state: "fail", points: 0, max: 5, detail: "Calls fell 12% compared with the previous period.", fix_hint: "Make sure the phone number and hours are correct and add a call-to-action in posts.", why_it_matters: "Calls are the most direct sign of new customers." },
          ],
          top_fixes: [
            { label: "Post an update every week", pillar: "activity", fix_hint: "Share a short update or offer every week." },
            { label: "Add more services", pillar: "completeness", fix_hint: "List every treatment you offer, with a short description." },
            { label: "Add new photos", pillar: "activity", fix_hint: "Photos of the team, the office and recent work." },
          ],
        },
        performance: {
          start: "2026-09-05",
          end: "2026-10-02",
          days: 28,
          totals: {
            impressions: sum("impressions"),
            maps: sum("maps"),
            search: sum("search"),
            mobile: Math.round(sum("impressions") * 0.71),
            desktop: Math.round(sum("impressions") * 0.29),
            calls: sum("calls"),
            website_clicks: sum("website_clicks"),
            direction_requests: sum("direction_requests"),
            conversations: 6,
            bookings: 9,
            actions: sum("actions"),
          },
          previous_change: { impressions: 0.12, maps: 0.15, search: 0.07, mobile: 0.14, desktop: 0.06, calls: -0.12, website_clicks: 0.21, direction_requests: 0.09, conversations: 0.5, bookings: 0.12, actions: 0.08 },
          last_year_change: { impressions: 0.34, maps: 0.4, search: 0.22, mobile: 0.38, desktop: 0.2, calls: 0.1, website_clicks: 0.3, direction_requests: 0.18, conversations: null, bookings: null, actions: 0.21 },
          by_surface: { maps: sum("maps"), search: sum("search") },
          by_device: { mobile: Math.round(sum("impressions") * 0.71), desktop: Math.round(sum("impressions") * 0.29) },
          actions_per_1000: 70.2,
          actions_per_1000_change: -0.03,
          by_day: days,
        },
        keywords: {
          latest_month: "2026-09",
          top: [
            { keyword: "dentist near me", value: 412, threshold: null, change: 0.18, tracked: true },
            { keyword: "maple leaf dental", value: 288, threshold: null, change: 0.05, tracked: false },
            { keyword: "emergency dentist", value: 141, threshold: null, change: 0.31, tracked: true },
            { keyword: "dentist toronto", value: 96, threshold: null, change: -0.04, tracked: false },
            { keyword: "teeth cleaning", value: 54, threshold: null, change: null, tracked: false },
            { keyword: "invisalign", value: null, threshold: 15, change: null, tracked: true },
          ],
        },
        profile: {
          title: "Maple Leaf Dental",
          primary_category: "Dentist",
          additional_categories: ["Cosmetic dentist", "Emergency dental service"],
          phone: "(416) 555-0144",
          website: "https://mapleleafdental.example",
          hours_set: true,
          description_length: 612,
          nap: [
            { field: "name", location: "Maple Leaf Dental", profile: "Maple Leaf Dental", match: true },
            { field: "phone", location: "(416) 555-0144", profile: "(416) 555-0144", match: true },
            { field: "website", location: "https://mapleleafdental.example", profile: "https://mapleleafdental.example", match: true },
          ],
        },
        verification: { verified: true, state: "verified" },
        reviews_media_posts: {
          reviews: { average_rating: 4.7, total: 184, new_90d: 11, reply_rate_90d: 0.92, median_reply_hours: 9, unreplied: 2 },
          media: { owner_count: 46, customer_count: 31, latest_owner_upload: "2026-09-21T15:00:00.000Z" },
          posts: { last_post_at: "2026-09-10T15:00:00.000Z", last_30_days: 1, last_90_days: 5 },
        },
      },
      competitor_analysis: {
        available: true,
        generated_at: current.generated_at,
        public_scores: [
          { name: "Maple Leaf Dental", is_self: true, score: 84 - index * 3, flag: null },
          { name: "King West Dental Studio", is_self: false, score: 88, flag: null },
          { name: "Downtown Smiles", is_self: false, score: 76, flag: null },
          { name: "Queen Street Dentistry", is_self: false, score: 71, flag: null },
          { name: "Bay Street Dental Care", is_self: false, score: 63, flag: null },
        ],
        table: [
          { name: "Maple Leaf Dental", is_self: true, rating: 4.7, reviews: 184, category: "Dentist", has_hours: true, has_website: true, has_phone: true, status: "OPERATIONAL", photos: 10, photos_capped: true },
          { name: "King West Dental Studio", is_self: false, rating: 4.8, reviews: 326, category: "Dentist", has_hours: true, has_website: true, has_phone: true, status: "OPERATIONAL", photos: 10, photos_capped: true },
          { name: "Downtown Smiles", is_self: false, rating: 4.5, reviews: 141, category: "Cosmetic dentist", has_hours: true, has_website: true, has_phone: true, status: "OPERATIONAL", photos: 8 },
          { name: "Queen Street Dentistry", is_self: false, rating: 4.6, reviews: 97, category: "Dentist", has_hours: false, has_website: true, has_phone: true, status: "OPERATIONAL", photos: 6 },
          { name: "Bay Street Dental Care", is_self: false, rating: 4.2, reviews: 58, category: "Dental clinic", has_hours: true, has_website: false, has_phone: true, status: "OPERATIONAL", photos: 4 },
        ],
        insights: [
          "King West Dental Studio has 142 more reviews than you; more reviews is the clearest way to pass them.",
          "You have the second-highest rating nearby.",
          "Only 3 of 5 businesses list complete hours; yours are complete.",
        ],
        reviews: [
          {
            name: "Maple Leaf Dental",
            is_self: true,
            items: [
              { rating: 5, text: "Friendly team and no waiting. They explained every step of my treatment.", when: "2 weeks ago", author: "Priya S.", author_uri: null },
              { rating: 4, text: "Great cleaning, parking is a bit tricky downtown.", when: "a month ago", author: "Marc L.", author_uri: null },
            ],
          },
          {
            name: "King West Dental Studio",
            is_self: false,
            items: [{ rating: 5, text: "Modern office and very gentle dentist.", when: "3 weeks ago", author: "Dana K.", author_uri: null }],
          },
        ],
      },
      citation: {
        available: true,
        as_of: current.generated_at,
        range: "28d",
        score: { score: 72, grade: "C", coverage: 0.8, total: 15, counts: { live_correct: 9, nap_wrong: 2, not_found: 3, submitted: 1 } },
        table: [
          { directory: "Yelp", type: "general", status: "live_correct", listing_url: "https://www.yelp.example/biz/maple-leaf-dental", last_checked_at: "2026-09-28T12:00:00.000Z", nap_issues: [] },
          { directory: "Bing Places", type: "general", status: "live_correct", listing_url: "https://bing.example/maps", last_checked_at: "2026-09-28T12:00:00.000Z", nap_issues: [] },
          { directory: "Apple Maps", type: "general", status: "nap_wrong", listing_url: "https://maps.apple.example", last_checked_at: "2026-09-27T12:00:00.000Z", nap_issues: ["phone"] },
          { directory: "Yellow Pages", type: "general", status: "nap_wrong", listing_url: "https://yellowpages.example", last_checked_at: "2026-09-26T12:00:00.000Z", nap_issues: ["address"] },
          { directory: "Facebook", type: "social", status: "live_correct", listing_url: "https://facebook.example/mapleleafdental", last_checked_at: "2026-09-25T12:00:00.000Z", nap_issues: [] },
          { directory: "RateMDs", type: "niche", status: "not_found", listing_url: null, last_checked_at: "2026-09-25T12:00:00.000Z", nap_issues: [] },
          { directory: "Foursquare", type: "general", status: "submitted", listing_url: null, last_checked_at: "2026-09-24T12:00:00.000Z", nap_issues: [] },
        ],
        nap_issues: {
          expected: { name: "Maple Leaf Dental", address: "120 King St W, Toronto, ON", phone: "(416) 555-0144", website: "https://mapleleafdental.example" },
          rows: [
            { directory: "Apple Maps", field: "phone", found: "(416) 555-0100", expected: "(416) 555-0144" },
            { directory: "Yellow Pages", field: "address", found: "118 King St W", expected: "120 King St W" },
          ],
        },
        changes: [
          { at: "2026-09-24T12:00:00.000Z", directory: "Foursquare", action: "status_changed", from: "not_found", to: "submitted" },
          { at: "2026-09-18T12:00:00.000Z", directory: "Bing Places", action: "status_changed", from: "nap_wrong", to: "live_correct" },
        ],
      },
      reputation: {
        available: true,
        as_of: current.generated_at,
        summary: { average_rating: 4.7, total: 184, new_this_month: 6 - index, positive: 171, negative: 7, reply_rate: 0.92, awaiting_attention: 2, flagged: 1 },
        distribution: [
          { stars: 5, count: 149 },
          { stars: 4, count: 22 },
          { stars: 3, count: 6 },
          { stars: 2, count: 3 },
          { stars: 1, count: 4 },
        ],
        needs_attention: [
          { rating: 2, date: "2026-09-29T12:00:00.000Z", excerpt: "Waited 40 minutes past my appointment time and nobody told me why.", flags: ["wait_time"], flag_level: "negative" },
          { rating: 1, date: "2026-09-22T12:00:00.000Z", excerpt: "I was charged for an X-ray I didn't need.", flags: ["billing"], flag_level: "negative" },
        ],
        replies_sent: {
          this_month: 5,
          last_90_days: 14,
          recent: [
            {
              rating: 5,
              review: "Dr. Chen was amazing with my kids.",
              reply: "Thank you so much! We loved meeting your family and look forward to seeing you at the next check-up.",
              date: "2026-09-27T12:00:00.000Z",
            },
          ],
        },
        insights: {
          available: true,
          generated_at: current.generated_at,
          themes: [
            { theme: "Friendly staff", mentions: 64, sentiment: "positive" },
            { theme: "Gentle care", mentions: 41, sentiment: "positive" },
            { theme: "Clean office", mentions: 28, sentiment: "positive" },
            { theme: "Wait times", mentions: 9, sentiment: "negative" },
            { theme: "Parking", mentions: 7, sentiment: "mixed" },
          ],
          praise: ["Staff are warm and explain treatments clearly", "Children feel at ease"],
          complaints: ["Occasional delays past appointment times", "Parking is hard to find"],
          observations: [],
        },
      },
    },
  };
}
