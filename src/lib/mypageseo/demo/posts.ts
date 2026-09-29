/** Demo Google Business Profile posts, derived from `demoLocation()` facts. */
import { demoDate, demoDateAhead, pickInt, pickOne, seedFrom } from "./demo-mode";
import { demoLocation, type DemoLocationFacts } from "./entities";
import type { GbpPost, GbpPostType, GbpPostsData, PostLifecycle } from "../../gbp/gbp-posts";

type PostSeed = { title: string; summary: string; type: GbpPostType; ctaLabel: string; ctaUrl: string };

const POST_LIBRARY: Record<string, PostSeed[]> = {
  cl_riverside: [
    { title: "New patient special: $89 exam, cleaning & X-rays", summary: "New patients save on a full exam, cleaning, and digital X-rays this month. Same-day scheduling available for most requests.", type: "offer", ctaLabel: "Book", ctaUrl: "https://riversidedental.com/schedule" },
    { title: "We now offer same-day emergency appointments", summary: "Chipped a tooth or dealing with sudden pain? We hold same-day slots every weekday for urgent dental needs.", type: "update", ctaLabel: "Call now", ctaUrl: "https://riversidedental.com/emergency" },
    { title: "Free teeth whitening consultation event", summary: "Join us for a free cosmetic consultation event, including whitening and veneer options, this Saturday.", type: "event", ctaLabel: "Learn more", ctaUrl: "https://riversidedental.com/events" },
    { title: "Meet our new pediatric dental hygienist", summary: "We've expanded our pediatric team to make visits easier and friendlier for younger patients.", type: "update", ctaLabel: "Learn more", ctaUrl: "https://riversidedental.com/team" },
    { title: "Invisalign financing now available", summary: "New flexible monthly financing plans make Invisalign treatment more accessible for adults and teens.", type: "offer", ctaLabel: "Get quote", ctaUrl: "https://riversidedental.com/invisalign" },
    { title: "Extended Saturday hours starting this month", summary: "We've added Saturday morning appointments to make scheduling easier around work and school.", type: "update", ctaLabel: "Book", ctaUrl: "https://riversidedental.com/schedule" },
  ],
  cl_hearth: [
    { title: "Fall tasting menu now available", summary: "Our seasonal five-course tasting menu features local produce, wild mushrooms, and a new dessert pairing.", type: "update", ctaLabel: "View menu", ctaUrl: "https://hearthandoak.com/menu" },
    { title: "Bottomless brunch every Sunday", summary: "Join us for bottomless mimosas and a new brunch menu every Sunday from 10am to 2pm.", type: "offer", ctaLabel: "Reserve", ctaUrl: "https://hearthandoak.com/reservations" },
    { title: "Live jazz night this Friday", summary: "Local jazz trio performs on the patio starting at 7pm — reservations recommended.", type: "event", ctaLabel: "Reserve", ctaUrl: "https://hearthandoak.com/events" },
    { title: "Private dining room now booking holiday parties", summary: "Our private dining room seats up to 30 guests with a customizable set menu for holiday gatherings.", type: "update", ctaLabel: "Learn more", ctaUrl: "https://hearthandoak.com/private-events" },
    { title: "Happy hour extended to 7pm on weekdays", summary: "Enjoy $6 cocktails and half-price appetizers Monday through Friday, now until 7pm.", type: "offer", ctaLabel: "View menu", ctaUrl: "https://hearthandoak.com/happy-hour" },
  ],
  cl_summit: [
    { title: "Free brake inspection through the end of the month", summary: "Stop in for a free multi-point brake inspection with any oil change service.", type: "offer", ctaLabel: "Book", ctaUrl: "https://summitautocare.com/schedule" },
    { title: "Now offering same-day tire replacement", summary: "Most tire sizes are in stock for same-day installation, no appointment required.", type: "update", ctaLabel: "Call now", ctaUrl: "https://summitautocare.com/tires" },
    { title: "Free vehicle safety check event this Saturday", summary: "Bring your vehicle in for a free 20-point safety inspection ahead of winter driving season.", type: "event", ctaLabel: "Learn more", ctaUrl: "https://summitautocare.com/events" },
    { title: "New diagnostic equipment for hybrid & EV service", summary: "We've added specialized diagnostic tools to service hybrid and electric vehicles in-house.", type: "update", ctaLabel: "Learn more", ctaUrl: "https://summitautocare.com/services" },
  ],
  cl_lumen: [
    { title: "Free 30-minute family law consultation", summary: "New clients receive a complimentary consultation to review custody, divorce, or mediation questions.", type: "offer", ctaLabel: "Schedule", ctaUrl: "https://lumenfamilylaw.com/consultation" },
    { title: "Understanding mediation vs. litigation", summary: "Read our latest guide comparing mediation and litigation timelines, costs, and outcomes for families.", type: "update", ctaLabel: "Learn more", ctaUrl: "https://lumenfamilylaw.com/resources" },
    { title: "Evening consultation hours now available", summary: "We've added evening appointment slots for clients who can't meet during standard business hours.", type: "update", ctaLabel: "Schedule", ctaUrl: "https://lumenfamilylaw.com/schedule" },
  ],
};

function libraryFor(location: DemoLocationFacts): PostSeed[] {
  return POST_LIBRARY[location.clientId] ?? POST_LIBRARY["cl_riverside"]!;
}

const FAILURE_REASONS = ["Image did not meet Google's content guidelines.", "Post was rejected for including a phone number in the body text.", "Publishing timed out — the connection to Google was interrupted."];

export function demoGbpPosts(locationId?: string | null): GbpPostsData {
  const location = demoLocation(locationId);
  const library = libraryFor(location);
  const seedBase = seedFrom(location.id, "gbp-posts");

  const lifecycles: PostLifecycle[] = [
    "published", "published", "published", "published", "published",
    "published", "published", "scheduled", "scheduled", "draft",
    "failed",
  ];

  const posts: GbpPost[] = lifecycles.map((status, index) => {
    const seed = seedBase + index * 71;
    const seedEntry = library[index % library.length]!;
    const isFuture = status === "scheduled";
    const daysOffset = isFuture ? pickInt(seed, 2, 21) : pickInt(seed, 1, 200);
    const date = isFuture ? demoDateAhead(daysOffset) : demoDate(daysOffset);
    const timestamp = `${date}T${String(9 + (index % 6)).padStart(2, "0")}:00:00.000Z`;

    return {
      id: `post_${location.id}_${index + 1}`,
      title: seedEntry.title,
      summary: seedEntry.summary,
      type: seedEntry.type,
      status,
      date,
      timestamp,
      ctaLabel: status === "draft" ? null : seedEntry.ctaLabel,
      ctaUrl: status === "draft" ? null : seedEntry.ctaUrl,
      mediaUrl: null,
      failureReason: status === "failed" ? pickOne(seed + 3, FAILURE_REASONS) : null,
      sourceUrl: status === "published" ? `https://posts.gle/${location.id}-${index + 1}` : null,
    };
  });

  return {
    status: "ready",
    lastCheckedAt: demoDate(1),
    posts,
    capabilities: {
      canCreate: true,
      canEdit: true,
      canSchedule: true,
      canPublish: true,
      canDelete: true,
      canRetry: true,
      canGenerateDraft: true,
      canUploadMedia: true,
      canSearch: true,
      supportedTypes: ["update", "offer", "event"],
      ctaOptions: [
        { value: "book", label: "Book" },
        { value: "learn_more", label: "Learn more" },
        { value: "call", label: "Call now" },
        { value: "order", label: "Order online" },
        { value: "shop", label: "Shop" },
      ],
    },
  };
}
