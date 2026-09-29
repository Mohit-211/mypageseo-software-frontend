/** Demo AI GBP posts and simulated AI output, derived from `DEMO_LOCATIONS`. */
import { addDays, setHours, setMinutes, startOfDay, subDays } from "date-fns";
import { pickInt, pickOne, seedFrom } from "./demo-mode";
import { DEMO_LOCATIONS } from "./entities";
import type {
  AiCopyRequest,
  AiGbpPost,
  AiPostCta,
  AiPostStatus,
  AiPostType,
  RecurrenceFrequency,
  Weekday,
} from "../../gbp/ai-posts";

type AiPostSeed = { topic: string; title: string; content: string; type: AiPostType; cta: AiPostCta };

const AI_POST_LIBRARY: Record<string, AiPostSeed[]> = {
  cl_riverside: [
    { topic: "New patient special", title: "New patient special: $89 exam & cleaning", content: "New to Riverside Dental? This month, new patients get a complete exam, professional cleaning and digital X-rays for just $89. Our team makes first visits relaxed and easy — most appointments are available within the week.", type: "offer", cta: "book" },
    { topic: "Same-day emergency care", title: "Same-day emergency appointments", content: "Chipped tooth or sudden pain? We keep same-day slots open every weekday for dental emergencies. Call us first thing and we'll get you seen, treated and comfortable as quickly as possible.", type: "whats_new", cta: "call_now" },
    { topic: "Teeth whitening event", title: "Free whitening consultation day", content: "Thinking about a brighter smile? Join us Saturday for free cosmetic consultations covering whitening, bonding and veneers. Meet our cosmetic team, see real before-and-after results and get a personalised plan.", type: "event", cta: "sign_up" },
    { topic: "Invisalign financing", title: "Invisalign with 0% financing", content: "Straighter teeth, flexible payments. Invisalign clear aligners are now available with 0% monthly financing for qualified patients. Book a scan to see your projected results in minutes.", type: "product", cta: "learn_more" },
    { topic: "Back-to-school checkups", title: "Back-to-school dental checkups", content: "Start the school year with a healthy smile. Our pediatric hygienists make checkups fun, quick and stress-free for kids of all ages. After-school appointments fill quickly — reserve yours today.", type: "whats_new", cta: "book" },
    { topic: "Saturday hours", title: "Now open Saturday mornings", content: "Busy weekdays? We've added Saturday appointments from 8am to 1pm so you can keep up with cleanings and checkups without missing work or school.", type: "whats_new", cta: "book" },
  ],
  cl_hearth: [
    { topic: "Fall tasting menu", title: "Our fall tasting menu is here", content: "Five courses celebrating the season: roasted squash velouté, wild mushroom risotto, braised short rib and a spiced pear tart. Wine pairings curated by our sommelier. Available Thursday to Sunday.", type: "product", cta: "book" },
    { topic: "Sunday brunch", title: "Bottomless brunch every Sunday", content: "Sundays just got better. Enjoy our new brunch menu with bottomless mimosas from 10am to 2pm — think brioche French toast, smoked salmon benedict and house-made pastries.", type: "offer", cta: "book" },
    { topic: "Live jazz night", title: "Live jazz on the patio this Friday", content: "Our favourite local jazz trio returns to the patio this Friday from 7pm. Pair the music with our late-night small plates menu. Tables go fast, so reserve early.", type: "event", cta: "book" },
    { topic: "Holiday private dining", title: "Book your holiday party with us", content: "Our private dining room seats up to 30 guests with a custom set menu and dedicated server. Holiday dates are filling quickly — let us plan an evening your team will remember.", type: "whats_new", cta: "learn_more" },
    { topic: "Happy hour", title: "Happy hour now until 7pm", content: "Weekday happy hour just got longer. Enjoy $6 signature cocktails and half-price starters Monday to Friday, 3pm to 7pm, at the bar and on the patio.", type: "offer", cta: "order_online" },
  ],
  cl_summit: [
    { topic: "Winter tire changeover", title: "Winter tire changeover is open", content: "Beat the first frost. Book your winter tire changeover now and get a free tread and pressure check. Most tire sizes are in stock for same-day installation.", type: "offer", cta: "book" },
    { topic: "Free brake inspection", title: "Free brake inspection this month", content: "Squeaks, grinding or a soft pedal? Get a free multi-point brake inspection with any oil change this month. Our ASE-certified technicians will walk you through everything we find.", type: "offer", cta: "book" },
    { topic: "Hybrid & EV service", title: "Now servicing hybrids & EVs", content: "We've invested in specialised diagnostic equipment and training so we can service hybrid and electric vehicles in-house — from battery health checks to brake and suspension work.", type: "whats_new", cta: "learn_more" },
    { topic: "Winter safety check", title: "Free winter safety check event", content: "Bring your vehicle in this Saturday for a free 20-point winter safety inspection: battery, wipers, lights, tires and fluids. Coffee's on us while you wait.", type: "event", cta: "sign_up" },
  ],
  cl_lumen: [
    { topic: "Free family law consultation", title: "Free 30-minute consultation", content: "Facing a custody, divorce or mediation question? New clients receive a free, confidential 30-minute consultation with one of our family law attorneys to understand their options.", type: "offer", cta: "book" },
    { topic: "Mediation vs litigation", title: "Mediation or litigation? A quick guide", content: "Our latest guide compares mediation and litigation — timelines, costs and what each means for your family. Read it before your first meeting so you can make an informed choice.", type: "whats_new", cta: "learn_more" },
    { topic: "Evening appointments", title: "Evening appointments now available", content: "We know family matters don't fit neatly into business hours. We now offer evening consultations Tuesday and Thursday until 8pm, in person or by video.", type: "whats_new", cta: "call_now" },
  ],
};

const FAILURE_REASONS = [
  "Google rejected the image: it did not meet content guidelines.",
  "Post was rejected for including a phone number in the body text.",
  "Publishing timed out — the connection to Google was interrupted.",
];

const TIME_SLOTS: [number, number][] = [[9, 0], [10, 30], [12, 0], [15, 0], [17, 30]];

/** Offsets (days from today) placing each location's posts around the current month. */
const DAY_OFFSETS = [-38, -31, -24, -17, -12, -7, -3, 0, 2, 5, 9, 12, 16, 23, 30, 37];

function statusFor(offset: number, index: number): AiPostStatus {
  if (offset < 0) return index === 3 ? "failed" : "published";
  if (offset === 0) return "scheduled";
  if (index % 5 === 1) return "pending_approval";
  if (index % 7 === 6) return "draft";
  return "scheduled";
}

/** Stable per-topic image. The URL stands in for AI or uploaded media. */
export function demoAiPostImage(topic: string, variant = 0): string {
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "post";
  return `https://picsum.photos/seed/${slug}-${variant}/800/600`;
}

export function demoAiGbpPosts(): AiGbpPost[] {
  const today = startOfDay(new Date());
  const posts: AiGbpPost[] = [];

  DEMO_LOCATIONS.forEach((location, locationIndex) => {
    const library = AI_POST_LIBRARY[location.clientId] ?? AI_POST_LIBRARY["cl_riverside"]!;
    const seedBase = seedFrom(location.id, "ai-posts");
    // Offset each location so their posts don't all land on the same days.
    const shift = locationIndex % 3;
    const offsets = DAY_OFFSETS.filter((_, i) => (i + locationIndex) % 3 !== 0);

    offsets.forEach((rawOffset, index) => {
      const offset = rawOffset + shift;
      const seed = seedBase + index * 97;
      const entry = library[(index + locationIndex) % library.length]!;
      const [h, m] = pickOne(seed, TIME_SLOTS);
      const scheduled = setMinutes(setHours(addDays(today, offset), h), m);
      const status = statusFor(offset, index);
      const recurrence: RecurrenceFrequency = index % 6 === 2 ? "weekly" : "none";
      const aiGenerated = index % 4 !== 3;

      posts.push({
        id: `aipost_${location.id}_${index + 1}`,
        locationId: location.id,
        businessName: location.businessName,
        topic: entry.topic,
        title: entry.title,
        content: entry.content,
        type: entry.type,
        cta: entry.cta,
        imageUrl: index % 9 === 8 ? null : demoAiPostImage(entry.topic, locationIndex),
        imageSource: index % 9 === 8 ? null : aiGenerated ? "ai" : "upload",
        aiGenerated,
        status,
        approvalStatus:
          status === "pending_approval" ? "pending" : index % 2 === 0 ? "approved" : "not_required",
        scheduledAt: status === "draft" && index % 2 === 0 ? null : scheduled.toISOString(),
        publishedAt: status === "published" ? scheduled.toISOString() : null,
        createdAt: subDays(scheduled, pickInt(seed + 1, 2, 9)).toISOString(),
        recurrence,
        recurrenceDays: recurrence === "weekly" ? [((scheduled.getDay() + 6) % 7) as Weekday] : [],
        failureReason: status === "failed" ? pickOne(seed + 3, FAILURE_REASONS) : null,
      });
    });
  });

  return posts;
}

/* -------------------------------------------------------------------------- */
/* Simulated AI copy                                                          */
/* -------------------------------------------------------------------------- */

const OPENERS: Record<AiCopyRequest["tone"], string[]> = {
  friendly: ["Hey neighbours!", "Good news for {area}!", "We've got something you'll love."],
  professional: ["We're pleased to share an update.", "An update for our {area} clients.", "Here's what's new at {business}."],
  promotional: ["Don't miss this!", "Limited time only!", "This is your sign to act now."],
};

const BODIES: Record<AiPostType, string[]> = {
  whats_new: [
    "At {business}, we're excited to talk about {topic}. Our team has put together fresh ideas and practical advice to help you get the most out of every visit.",
    "{topic} is on our minds this season. Stop by {business} to learn more — our team is always happy to answer questions and share expert recommendations.",
  ],
  offer: [
    "For a limited time, {business} is offering a special on {topic}. Mention this post when you book to claim your savings — offer valid while availability lasts.",
    "Save on {topic} at {business} this month. It's the perfect time to treat yourself and try something new with our team.",
  ],
  event: [
    "Join {business} for a special {topic} event! Meet our team, get expert tips and enjoy exclusive on-the-day perks. Spaces are limited, so reserve yours early.",
    "Mark your calendar: we're hosting a {topic} event at {business}. It's free to attend and a great chance to meet the people behind our work.",
  ],
  product: [
    "Introducing {topic} at {business}. Carefully selected to deliver great results, it's available now — ask our team which option is right for you.",
    "Now available at {business}: {topic}. Quality you can trust, backed by the local team {area} knows and loves.",
  ],
};

const CLOSERS = [
  "We can't wait to see you!",
  "Visit us today or get in touch to learn more.",
  "Thanks for supporting a local {area} business.",
];

const TITLES: Record<AiPostType, string[]> = {
  whats_new: ["{Topic}: what you need to know", "Fresh update: {topic}"],
  offer: ["Special offer: {topic}", "Save this month on {topic}"],
  event: ["You're invited: {topic}", "Join us for {topic}"],
  product: ["Now available: {topic}", "Introducing {topic}"],
};

function fill(template: string, request: AiCopyRequest): string {
  const topic = request.topic.trim();
  return template
    .replaceAll("{Topic}", topic.charAt(0).toUpperCase() + topic.slice(1))
    .replaceAll("{topic}", topic.toLowerCase())
    .replaceAll("{business}", request.businessName)
    .replaceAll("{area}", request.area);
}

export function demoAiPostCopy(request: AiCopyRequest): { title: string; content: string } {
  const v = request.variant;
  const opener = OPENERS[request.tone][v % OPENERS[request.tone].length]!;
  const body = BODIES[request.type][v % BODIES[request.type].length]!;
  const closer = CLOSERS[(v + 1) % CLOSERS.length]!;
  const title = TITLES[request.type][v % TITLES[request.type].length]!;
  return {
    title: fill(title, request),
    content: fill(`${opener} ${body}\n\n${closer}`, request),
  };
}
