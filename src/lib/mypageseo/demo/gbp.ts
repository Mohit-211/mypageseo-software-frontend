/**
 * Demo Google Business Profile facts (overview, audit, audit competitors).
 * Derived from `demoLocation()` so every GBP screen reads as one connected,
 * internally consistent profile.
 */
import { demoDate, pickInt, seedFrom } from "./demo-mode";
import { demoCompetitors, demoKeywords, demoLocation, type DemoLocationFacts } from "./entities";
import type { GbpAction, GbpHealthFactor, GbpItemStatus, GbpOverviewData, GbpProfileField } from "../../gbp/gbp-overview";
import type { AuditCategory, AuditFinding, AuditFindingStatus, GbpAuditData } from "../../gbp/gbp-audit";
import type {
  GbpAuditCompetitiveFinding,
  GbpAuditCompetitorEntity,
  GbpAuditCompetitorsData,
  GbpAuditRankingComparison,
} from "../gbp-audit-competitors";

function healthLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 55) return "Needs attention";
  return "At risk";
}

function formatHours(location: DemoLocationFacts): string {
  const seed = seedFrom(location.id, "hours");
  const open = pickOneHour(seed);
  const close = pickOneHour(seed + 1, true);
  return `Mon–Fri ${open}–${close} · Sat 9:00 AM–2:00 PM · Sun closed`;
}

function pickOneHour(seed: number, pm = false): string {
  const hour = pickInt(seed, pm ? 4 : 7, pm ? 6 : 9);
  const displayHour = pm ? hour : hour;
  return `${displayHour}:00 ${pm ? "PM" : "AM"}`;
}

/** Builds the connected GBP overview for a location, deterministic per location id. */
export function demoGbpOverview(locationId?: string | null): GbpOverviewData {
  const location = demoLocation(locationId);
  const seed = seedFrom(location.id, "gbp-overview");

  const healthFactors: GbpHealthFactor[] = [
    {
      id: "hf_profile_info",
      label: "Business information accuracy",
      status: location.gbpHealth >= 70 ? "complete" : "attention",
      detail: location.gbpHealth >= 70 ? "Name, address, and phone match your website and top citations." : "Some directories list an outdated suite number.",
    },
    {
      id: "hf_categories",
      label: "Category selection",
      status: location.additionalCategories.length >= 2 ? "complete" : "attention",
      detail: `${location.primaryCategory} plus ${location.additionalCategories.length} additional ${location.additionalCategories.length === 1 ? "category" : "categories"}.`,
    },
    {
      id: "hf_reviews",
      label: "Review responsiveness",
      status: location.unansweredReviews <= 10 ? "complete" : "attention",
      detail: `${location.unansweredReviews} review${location.unansweredReviews === 1 ? "" : "s"} currently awaiting a reply.`,
    },
    {
      id: "hf_photos",
      label: "Photo coverage",
      status: location.photoCount >= 80 ? "complete" : "attention",
      detail: `${location.photoCount} photos on file across interior, exterior, and team categories.`,
    },
    {
      id: "hf_posts",
      label: "Posting cadence",
      status: pickInt(seed + 3, 0, 1) === 1 ? "complete" : "attention",
      detail: "Weekly updates and offers keep the profile active in Google's ranking signals.",
    },
  ];

  const completeness: GbpHealthFactor[] = [
    { id: "cp_description", label: "Business description", status: "complete", detail: "A 750-character description covering services and service area is published." },
    { id: "cp_attributes", label: "Attributes", status: location.gbpHealth >= 75 ? "complete" : "attention", detail: location.gbpHealth >= 75 ? "Accessibility, payment, and amenity attributes are filled in." : "Several optional attributes (parking, accessibility) are not set." },
    { id: "cp_products", label: "Products / services list", status: pickInt(seed + 5, 0, 1) === 1 ? "complete" : "attention", detail: "Structured services with pricing help searchers compare before they click." },
    { id: "cp_qanda", label: "Questions & answers monitoring", status: location.unansweredReviews > 15 ? "attention" : "complete", detail: "Unanswered questions can be mistaken for unresponsive ownership." },
    { id: "cp_booking", label: "Booking / appointment link", status: location.website ? "complete" : "attention", detail: location.website ? `Linked to ${location.website}` : "No scheduling link is attached to the profile." },
  ] satisfies GbpHealthFactor[];

  const profile: GbpProfileField[] = [
    { label: "Business name", value: location.businessName },
    { label: "Primary category", value: location.primaryCategory },
    { label: "Additional categories", value: location.additionalCategories.join(", ") },
    { label: "Address", value: `${location.street}, ${location.city}, ${location.state} ${location.postalCode}` },
    { label: "Phone", value: location.phone },
    { label: "Website", value: location.website },
    { label: "Hours", value: formatHours(location) },
  ];

  const actions: GbpAction[] = [];
  if (location.unansweredReviews > 5) {
    actions.push({
      id: "act_reviews",
      title: `Respond to ${location.unansweredReviews} open reviews`,
      description: "Replying within a few days improves reputation signals and customer trust.",
      destination: "reviews",
    });
  }
  actions.push(
    {
      id: "act_audit",
      title: "Review the latest profile audit",
      description: "See which profile, media, and local search checks need attention.",
      destination: "audit",
    },
    {
      id: "act_posts",
      title: "Publish a new update post",
      description: "Regular posts keep the profile active and surface recent offers to searchers.",
      destination: "posts",
    },
  );

  return {
    status: "ready",
    healthScore: location.gbpHealth,
    healthLabel: healthLabel(location.gbpHealth),
    healthFactors,
    profile,
    completeness,
    reviews: {
      averageRating: location.rating,
      total: location.reviewCount,
      unanswered: location.unansweredReviews,
      recentActivity: `${location.reviewsLast30} new reviews in the last 30 days`,
    },
    media: {
      photoCount: location.photoCount,
      status: location.photoCount >= 100 ? "Strong photo coverage" : "Additional recent photos would help",
    },
    rankingContext: {
      localPackCoverage: location.localPackCoverage,
      detail: `Appears in the Local Pack for ${location.localPackCoverage}% of tracked searches near ${location.city}.`,
    },
    actions,
  };
}

type FindingSeed = { id: string; title: string; status: AuditFindingStatus; summary: string; whyItMatters: string; nextStep: string | null };

function findingsFor(location: DemoLocationFacts): { categories: AuditCategory[]; passed: number; attention: number } {
  const seed = seedFrom(location.id, "gbp-audit");
  let passed = 0;
  let attention = 0;

  function bucket(defs: FindingSeed[]): AuditFinding[] {
    return defs.map((finding) => {
      if (finding.status === "healthy") passed += 1;
      else attention += 1;
      return { id: finding.id, title: finding.title, status: finding.status, summary: finding.summary, whyItMatters: finding.whyItMatters, nextStep: finding.nextStep };
    });
  }

  const categories: AuditCategory[] = [
    {
      id: "cat_profile",
      title: "Profile information",
      description: "Business identity, categories, and contact details",
      status: location.gbpHealth >= 75 ? "healthy" : "attention",
      findings: bucket([
        { id: "f_name", title: "Business name matches signage", status: "healthy", summary: `"${location.businessName}" matches the storefront and website title.`, whyItMatters: "A mismatched name is a common cause of suspended listings.", nextStep: null },
        { id: "f_categories", title: "Category coverage", status: location.additionalCategories.length >= 2 ? "healthy" : "attention", summary: `Primary category is ${location.primaryCategory} with ${location.additionalCategories.length} additional categor${location.additionalCategories.length === 1 ? "y" : "ies"}.`, whyItMatters: "Additional relevant categories widen the searches this profile can rank for.", nextStep: location.additionalCategories.length >= 2 ? null : "Add one or two more accurate secondary categories." },
        { id: "f_hours", title: "Business hours published", status: "healthy", summary: "Standard hours and no unusual gaps were found.", whyItMatters: "Accurate hours reduce 'temporarily closed' mislabeling.", nextStep: null },
        { id: "f_service_area", title: "Service area configuration", status: pickInt(seed + 1, 0, 4) === 0 ? "attention" : "healthy", summary: "Service area overlaps with nearby sibling locations.", whyItMatters: "Overlapping service areas can cause Google to suppress duplicate results.", nextStep: "Narrow the configured service area radius." },
      ]),
    },
    {
      id: "cat_reviews",
      title: "Reviews & reputation",
      description: "Review volume, recency, and response behavior",
      status: location.unansweredReviews > 15 ? "attention" : "healthy",
      findings: bucket([
        { id: "f_review_volume", title: "Review volume vs. category average", status: location.reviewCount >= 150 ? "healthy" : "attention", summary: `${location.reviewCount} total reviews at a ${location.rating.toFixed(1)} average rating.`, whyItMatters: "Review volume is a strong local ranking and trust signal.", nextStep: location.reviewCount >= 150 ? null : "Prompt recent customers for reviews after service." },
        { id: "f_review_response", title: "Response rate", status: location.unansweredReviews > 15 ? "warning" : "healthy", summary: `${location.unansweredReviews} reviews are currently unanswered.`, whyItMatters: "Unanswered reviews, especially negative ones, reduce conversion from profile visitors.", nextStep: location.unansweredReviews > 15 ? "Clear the response backlog, prioritizing 1–3 star reviews." : null },
        { id: "f_recent_reviews", title: "Review recency", status: location.reviewsLast30 >= 8 ? "healthy" : "attention", summary: `${location.reviewsLast30} reviews were collected in the last 30 days.`, whyItMatters: "Recent reviews carry more ranking weight than older reviews.", nextStep: location.reviewsLast30 >= 8 ? null : "Add a review request step to the post-visit workflow." },
      ]),
    },
    {
      id: "cat_media",
      title: "Photos & media",
      description: "Photo volume, coverage, and freshness",
      status: location.photoCount >= 80 ? "healthy" : "attention",
      findings: bucket([
        { id: "f_photo_volume", title: "Photo volume", status: location.photoCount >= 80 ? "healthy" : "incomplete", summary: `${location.photoCount} photos are published on the profile.`, whyItMatters: "Profiles with more photos receive more direction requests and clicks.", nextStep: location.photoCount >= 80 ? null : "Upload recent interior, exterior, and team photos." },
        { id: "f_photo_freshness", title: "Photo freshness", status: pickInt(seed + 2, 0, 3) === 0 ? "attention" : "healthy", summary: "Most recent customer photo upload was within the expected window.", whyItMatters: "Stale photo libraries can make a business look inactive.", nextStep: null },
      ]),
    },
    {
      id: "cat_duplicates",
      title: "Duplicate & consistency checks",
      description: "Listing uniqueness and NAP consistency across the web",
      status: location.citationIssues > 15 ? "attention" : "healthy",
      findings: bucket([
        { id: "f_duplicate_listing", title: "Duplicate listing scan", status: "healthy", summary: "No duplicate Google Business Profile listings were found for this address.", whyItMatters: "Duplicate listings split review counts and ranking signals.", nextStep: null },
        { id: "f_nap_consistency", title: "NAP consistency across directories", status: location.citationIssues > 15 ? "warning" : "healthy", summary: `${location.citationIssues} of ${location.citationTotal} tracked citations have inconsistent name, address, or phone data.`, whyItMatters: "Inconsistent NAP data confuses Google's confidence in the business's true location.", nextStep: location.citationIssues > 15 ? "Correct the highest-authority inconsistent citations first." : null },
      ]),
    },
    {
      id: "cat_website",
      title: "Website & conversion signals",
      description: "Linked website and conversion path health",
      status: "healthy",
      findings: bucket([
        { id: "f_website_link", title: "Website link", status: "healthy", summary: `Profile links to ${location.website}.`, whyItMatters: "A working website link is required for most conversion actions.", nextStep: null },
        { id: "f_utm", title: "Tracking parameters", status: pickInt(seed + 4, 0, 2) === 0 ? "attention" : "healthy", summary: "Website link includes UTM parameters for attribution.", whyItMatters: "Attribution tracking shows how much traffic and revenue GBP drives.", nextStep: null },
      ]),
    },
    {
      id: "cat_local_search",
      title: "Local search performance",
      description: "Local Pack visibility and competitive standing",
      status: location.localPackCoverage >= 50 ? "healthy" : "attention",
      findings: bucket([
        { id: "f_local_pack", title: "Local Pack coverage", status: location.localPackCoverage >= 50 ? "healthy" : "attention", summary: `Appears in the Local Pack for ${location.localPackCoverage}% of tracked searches.`, whyItMatters: "Local Pack placement drives the majority of map-based calls and visits.", nextStep: location.localPackCoverage >= 50 ? null : "Strengthen reviews, citations, and posting cadence to improve pack coverage." },
        { id: "f_rank_trend", title: "Average rank trend", status: location.averageRankChange <= 0 ? "healthy" : "attention", summary: `Average tracked rank moved ${location.averageRankChange > 0 ? "down" : "up"} ${Math.abs(location.averageRankChange).toFixed(1)} positions.`, whyItMatters: "Rank trend indicates whether recent optimization work is paying off.", nextStep: null },
      ]),
    },
  ];

  return { categories, passed, attention };
}

/** Builds a location-level GBP audit whose score matches `gbpHealth`. */
export function demoGbpAudit(locationId?: string | null): GbpAuditData {
  const location = demoLocation(locationId);
  const { categories, passed, attention } = findingsFor(location);

  return {
    status: "ready",
    checkedAt: demoDate(2),
    score: location.gbpHealth,
    scoreLabel: healthLabel(location.gbpHealth),
    scoreExplanation: `Weighted across ${passed + attention} checks covering profile information, reviews, media, duplicates, website signals, and local search performance.`,
    summary: { passed, attention, unavailable: 0 },
    categories,
    previousAudit: { checkedAt: demoDate(32), score: Math.max(0, Math.min(100, location.gbpHealth - (attention >= 6 ? 4 : -3))) },
    canRunAudit: true,
  };
}

/** Builds the Local Pack competitor comparison for a location's audit. */
export function demoGbpAuditCompetitors(locationId?: string | null): GbpAuditCompetitorsData {
  const location = demoLocation(locationId);
  const competitors = demoCompetitors(location.id);
  const keywords = demoKeywords(location.id).filter((k) => k.currentPosition !== null).slice(0, 5);

  const sortedByRank = [...competitors].sort((a, b) => a.averageRank - b.averageRank);
  const locationPosition = Math.max(1, Math.round(location.averageRank / 3));

  const selfEntity: GbpAuditCompetitorEntity = {
    id: `entity_${location.id}_self`,
    name: location.businessName,
    isSelectedLocation: true,
    localPackPosition: { value: locationPosition, previousValue: locationPosition + (location.averageRankChange > 0 ? 1 : -1) },
    citations: { value: location.citationTotal, previousValue: location.citationTotal - 3 },
    keyCitations: { value: Math.round(location.citationTotal * 0.35), previousValue: Math.round(location.citationTotal * 0.35) - 1 },
    links: { value: Math.round(location.gbpHealth * 9), previousValue: Math.round(location.gbpHealth * 9) - 40 },
    linkingDomains: { value: Math.round(location.gbpHealth * 1.4), previousValue: Math.round(location.gbpHealth * 1.4) - 3 },
    websiteAuthority: { value: Math.round(20 + location.gbpHealth * 0.3), previousValue: Math.round(20 + location.gbpHealth * 0.3) - 1 },
    reviewCount: { value: location.reviewCount, previousValue: location.reviewCount - location.reviewsLast30 },
    starRating: { value: location.rating, previousValue: location.rating },
    photos: { value: location.photoCount, previousValue: location.photoCount - 6 },
    primaryCategory: location.primaryCategory,
  };

  const competitorEntities: GbpAuditCompetitorEntity[] = sortedByRank.map((competitor, index) => ({
    id: competitor.id,
    name: competitor.name,
    isSelectedLocation: false,
    localPackPosition: { value: index === 0 && locationPosition === 1 ? locationPosition + 1 : index + 1, previousValue: index + 2 },
    citations: { value: competitor.citationCount, previousValue: competitor.citationCount - 2 },
    keyCitations: { value: Math.round(competitor.citationCount * 0.4), previousValue: Math.round(competitor.citationCount * 0.4) - 1 },
    links: { value: competitor.backlinks, previousValue: Math.round(competitor.backlinks * 0.92) },
    linkingDomains: { value: competitor.linkingDomains, previousValue: Math.round(competitor.linkingDomains * 0.95) },
    websiteAuthority: { value: competitor.domainAuthority, previousValue: competitor.domainAuthority - 1 },
    reviewCount: { value: competitor.reviewCount, previousValue: Math.round(competitor.reviewCount * 0.94) },
    starRating: { value: competitor.rating, previousValue: competitor.rating },
    photos: { value: competitor.photoCount, previousValue: Math.round(competitor.photoCount * 0.9) },
    primaryCategory: competitor.primaryCategory,
  }));

  const entities = [selfEntity, ...competitorEntities];

  const topCompetitor = competitorEntities[0] ?? null;
  const findings: GbpAuditCompetitiveFinding[] = topCompetitor
    ? [
        {
          id: "cf_reviews",
          title: "Review volume gap",
          observation: `${topCompetitor.name} has ${((topCompetitor.reviewCount.value as number) - location.reviewCount) > 0 ? "more" : "fewer"} reviews than this location.`,
          metric: "Reviews",
          locationValue: location.reviewCount,
          competitorName: topCompetitor.name,
          competitorValue: topCompetitor.reviewCount.value as number,
        },
        {
          id: "cf_photos",
          title: "Photo coverage gap",
          observation: `${topCompetitor.name} maintains a ${((topCompetitor.photos.value as number) > location.photoCount) ? "larger" : "smaller"} photo library, which affects profile engagement.`,
          metric: "Photos",
          locationValue: location.photoCount,
          competitorName: topCompetitor.name,
          competitorValue: topCompetitor.photos.value as number,
        },
        {
          id: "cf_citations",
          title: "Citation authority gap",
          observation: `${topCompetitor.name}'s website authority is ${((topCompetitor.websiteAuthority.value as number) > (selfEntity.websiteAuthority.value as number)) ? "higher" : "lower"}, influencing Local Pack ranking strength.`,
          metric: "Website authority",
          locationValue: selfEntity.websiteAuthority.value as number,
          competitorName: topCompetitor.name,
          competitorValue: topCompetitor.websiteAuthority.value as number,
        },
      ]
    : [];

  const rankingComparison: GbpAuditRankingComparison[] = keywords.map((keyword, index) => ({
    id: `rc_${location.id}_${index}`,
    keyword: keyword.keyword,
    businessName: location.businessName,
    currentPosition: keyword.currentPosition,
    previousPosition: keyword.previousPosition,
    movement: keyword.currentPosition !== null && keyword.previousPosition !== null ? keyword.previousPosition - keyword.currentPosition : null,
    resultType: keyword.resultType === "local_finder" ? "Local Finder" : "Local Pack",
  }));

  return {
    status: "ready",
    analyzedAt: demoDate(2),
    searchContext: { keyword: keywords[0]?.keyword ?? location.primaryCategory.toLowerCase(), area: location.area, resultType: "Local Pack" },
    contexts: [{ id: "ctx_primary", label: `${location.primaryCategory} near ${location.city}` }],
    selectedContextId: "ctx_primary",
    entities,
    findings,
    rankingComparison,
  };
}
