/** Demo Google Business Profile reviews, derived from `demoLocation()` facts. */
import { demoDate, pickInt, pickOne, seedFrom } from "./demo-mode";
import { demoLocation, type DemoLocationFacts } from "./entities";
import type { GbpReview, GbpReviewsData } from "../gbp-reviews";

const REVIEWER_FIRST = ["Sarah", "Michael", "Jessica", "David", "Amanda", "Chris", "Emily", "Brian", "Nicole", "Kevin", "Rachel", "Jason", "Laura", "Andrew", "Megan", "Tyler", "Danielle", "Ryan", "Ashley", "Marcus", "Grace", "Jordan", "Olivia", "Sean", "Priya", "Carlos", "Hannah", "Derek", "Monica", "Alex"];
const REVIEWER_LAST = ["T.", "R.", "M.", "K.", "S.", "B.", "L.", "H.", "W.", "P.", "G.", "D.", "C.", "N.", "F."];

const TEMPLATES: Record<string, { rating: number; texts: string[] }[]> = {
  cl_riverside: [
    { rating: 5, texts: ["The hygienist was gentle and the whole visit took half the time I expected.", "Front desk got me in same-day for a chipped tooth and the fix looks great.", "Dr. and the team explained every step before doing any work — first dentist I've trusted in years.", "Clean office, friendly staff, and they actually run on schedule."] },
    { rating: 4, texts: ["Good cleaning, just wish appointment reminders came a bit earlier.", "Solid experience overall, the wait was a little longer than booked.", "Friendly team, would like more evening appointment slots."] },
    { rating: 3, texts: ["Care was fine but billing took three calls to sort out.", "Appointment was rescheduled once, otherwise a normal visit."] },
    { rating: 2, texts: ["Waited 40 minutes past my appointment time with no update from the front desk.", "Treatment plan pricing wasn't explained clearly upfront."] },
    { rating: 1, texts: ["Booked online but showed up to find no record of my appointment.", "Left with more pain than I came in with and couldn't get a follow-up call back."] },
  ],
  cl_hearth: [
    { rating: 5, texts: ["Best brunch in the neighborhood — the short rib hash is worth the wait.", "Server remembered our order from last time, food came out perfect and hot.", "Great spot for a date night, cocktails and the seasonal menu were excellent.", "Private room for our team dinner was fantastic, chef even came out to say hi."] },
    { rating: 4, texts: ["Food was great, just a bit loud on a Friday night.", "Solid menu, service was a little slow during the rush.", "Really enjoyed the wine list, entrees took a while to come out."] },
    { rating: 3, texts: ["Food was good but portions felt smaller than the price suggests.", "Average visit, service was polite but forgettable."] },
    { rating: 2, texts: ["Reservation wasn't honored and we waited 25 minutes for a table.", "Dish arrived cold and had to be sent back."] },
    { rating: 1, texts: ["Charged for items we didn't order and it took forever to get it corrected.", "Service was inattentive the entire meal, never got a refill."] },
  ],
  cl_summit: [
    { rating: 5, texts: ["Diagnosed the noise in ten minutes that another shop couldn't find in a week.", "Honest quote, finished ahead of schedule, and showed me the old parts.", "They've kept my truck running for years without ever upselling me.", "Loaner car made the whole repair painless."] },
    { rating: 4, texts: ["Good work, just took a day longer than quoted.", "Fair pricing, waiting area could use an update."] },
    { rating: 3, texts: ["Repair was fine, but I had to call twice for a status update.", "Got the job done, nothing special about the experience."] },
    { rating: 2, texts: ["Same issue came back within a month of the repair.", "Quoted price jumped once they had the car on the lift."] },
    { rating: 1, texts: ["Car sat for three days before anyone even looked at it.", "Was told one thing over the phone and charged for something else entirely."] },
  ],
  cl_lumen: [
    { rating: 5, texts: ["Walked me through a difficult custody case with patience and clear advice at every step.", "Responsive by email, always prepared for hearings, got a fair outcome.", "Made an incredibly stressful process feel manageable — grateful for the whole team.", "Straightforward about costs and timelines from the very first consultation."] },
    { rating: 4, texts: ["Good representation, communication could be a little faster.", "Knowledgeable attorney, billing statements were sometimes confusing."] },
    { rating: 3, texts: ["Case was handled fine but felt like just another file on the pile.", "Outcome was acceptable, wish there had been more regular updates."] },
    { rating: 2, texts: ["Hard to get a call back during a critical part of my case.", "Retainer ran out faster than I expected with little warning."] },
    { rating: 1, texts: ["Missed a filing deadline that cost us time in court.", "Barely heard from my attorney for months at a time."] },
  ],
};

const OWNER_RESPONSES: Record<number, string[]> = {
  5: ["Thank you so much for the kind words — we're glad the visit went smoothly and look forward to seeing you again!", "We really appreciate you taking the time to share this. Thanks for trusting us!"],
  4: ["Thanks for the feedback — we're working on tightening up scheduling and appreciate you flagging it.", "Glad you had a good experience overall. We'll pass your note about wait times to the team."],
  3: ["Thank you for the honest feedback. We'd like to make this right — please reach out to our front desk directly.", "We appreciate you sharing this and will use it to improve the experience going forward."],
  2: ["We're sorry this visit didn't meet expectations. Please contact us directly so we can address it.", "This isn't the experience we aim for — we'd like to speak with you to fix this."],
  1: ["We sincerely apologize for this experience. Please call us directly so we can make this right immediately.", "This falls well short of our standard. We'd appreciate the chance to resolve this — please reach out."],
};

function industryKey(location: DemoLocationFacts): string {
  return TEMPLATES[location.clientId] ? location.clientId : "cl_riverside";
}

const REVIEW_COUNT = 55;

export function demoGbpReviews(locationId?: string | null): GbpReviewsData {
  const location = demoLocation(locationId);
  const key = industryKey(location);
  const buckets = TEMPLATES[key]!;
  const seedBase = seedFrom(location.id, "gbp-reviews");

  const reviews: GbpReview[] = Array.from({ length: REVIEW_COUNT }, (_, index) => {
    const seed = seedBase + index * 97;
    // Weight ratings around the location's actual average.
    const roll = pickInt(seed, 0, 99);
    let rating: number;
    if (location.rating >= 4.6) rating = roll < 65 ? 5 : roll < 88 ? 4 : roll < 96 ? 3 : roll < 99 ? 2 : 1;
    else if (location.rating >= 4.2) rating = roll < 50 ? 5 : roll < 80 ? 4 : roll < 92 ? 3 : roll < 97 ? 2 : 1;
    else rating = roll < 35 ? 5 : roll < 62 ? 4 : roll < 82 ? 3 : roll < 93 ? 2 : 1;

    const bucket = buckets.find((b) => b.rating === rating) ?? buckets[0]!;
    const text = pickOne(seed + 1, bucket.texts);
    const reviewer = `${pickOne(seed + 2, REVIEWER_FIRST)} ${pickOne(seed + 3, REVIEWER_LAST)}`;
    const daysAgo = 2 + pickInt(seed + 4, 0, 540);
    const timestamp = `${demoDate(daysAgo)}T00:00:00.000Z`;

    return {
      id: `rev_${location.id}_${index + 1}`,
      reviewer,
      rating,
      text,
      date: demoDate(daysAgo),
      timestamp,
      responseState: "responded" as const,
      responseText: null,
      responseDate: null,
      sourceUrl: `https://search.google.com/local/reviews?placeid=${location.id}&review=${index + 1}`,
    };
  }).sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));

  // The most recent `unansweredReviews` reviews stay unanswered; the rest get an owner response.
  const unansweredCount = Math.min(location.unansweredReviews, reviews.length);
  reviews.forEach((review, index) => {
    if (index < unansweredCount) {
      review.responseState = "unanswered";
      return;
    }
    const seed = seedBase + index * 53;
    const responseDelay = pickInt(seed, 1, 4);
    const reviewDate = new Date(review.timestamp as string);
    reviewDate.setUTCDate(reviewDate.getUTCDate() + responseDelay);
    review.responseText = pickOne(seed + 6, OWNER_RESPONSES[review.rating ?? 5] ?? OWNER_RESPONSES[5]!);
    review.responseDate = reviewDate.toISOString().slice(0, 10);
  });

  const distributionCounts = [1, 2, 3, 4, 5].map((rating) => reviews.filter((r) => r.rating === rating).length);
  const sampleTotal = distributionCounts.reduce((sum, count) => sum + count, 0);
  const distribution = [1, 2, 3, 4, 5].map((rating, index) => ({
    rating,
    count: sampleTotal > 0 ? Math.max(0, Math.round((distributionCounts[index]! / sampleTotal) * location.reviewCount)) : 0,
  }));

  return {
    status: "ready",
    lastCheckedAt: demoDate(1),
    summary: {
      averageRating: location.rating,
      total: location.reviewCount,
      unanswered: location.unansweredReviews,
      distribution,
    },
    reviews,
    capabilities: {
      canRespond: true,
      canEditResponse: true,
      canGenerateResponse: true,
      canSearch: true,
      canFilterByDate: true,
    },
  };
}
