/**
 * Demo AI Visibility data: profiles, tracked prompts, simulated AI responses,
 * competitors and daily visibility history.
 *
 * Everything here is sample data. No AI provider is queried; responses are
 * written to look like real assistant answers so the interface can be reviewed.
 */
import { startOfDay, subDays, subHours } from "date-fns";
import { pickInt, rng, seedFrom } from "./demo-mode";
import type {
  AiPlatform,
  AiVisibilityCompetitor,
  AiVisibilityDataset,
  AiVisibilityProfile,
  PromptCheck,
  PromptFrequency,
  TopicId,
  TrackedPrompt,
  VisibilityHistoryPoint,
} from "../../ai-visibility/ai-visibility";

export const DEMO_AI_VISIBILITY_PROFILES: AiVisibilityProfile[] = [
  { id: "aiv_glow_delhi", businessName: "Glow & Co. Beauty Studio", city: "Delhi" },
  { id: "aiv_glow_gurugram", businessName: "Glow & Co. Skin Clinic", city: "Gurugram" },
];

const PLATFORMS: AiPlatform[] = ["chatgpt", "gemini", "perplexity", "claude"];

/** Latest visibility per platform relative to the overall score. */
const PLATFORM_OFFSET: Record<AiPlatform, number> = { chatgpt: 4, gemini: -3, perplexity: 1, claude: -2 };

/** Average daily mentions per platform. */
const PLATFORM_MENTION_RATE: Record<AiPlatform, number> = { chatgpt: 1.27, gemini: 1.03, perplexity: 1.13, claude: 0.77 };

/* -------------------------------------------------------------------------- */
/* Prompts                                                                    */
/* -------------------------------------------------------------------------- */

type PromptSeed = { text: string; topic: TopicId; strength: number };

/** `{city}` is replaced per profile. `strength` is the prompt's base visibility. */
const PROMPT_LIBRARY: PromptSeed[] = [
  // Beauty services (12)
  { text: "Best beauty professionals in {city}", topic: "beauty_services", strength: 86 },
  { text: "Best beauty services in {city}", topic: "beauty_services", strength: 82 },
  { text: "Where can I get a full bridal beauty package in {city}?", topic: "beauty_services", strength: 88 },
  { text: "Top rated beauty parlours in {city}", topic: "beauty_services", strength: 84 },
  { text: "Affordable beauty salon with good reviews in {city}", topic: "beauty_services", strength: 79 },
  { text: "Beauty salon open on Sunday in {city}", topic: "beauty_services", strength: 81 },
  { text: "Which salon in {city} offers pre-wedding packages?", topic: "beauty_services", strength: 87 },
  { text: "Luxury beauty studio in {city}", topic: "beauty_services", strength: 85 },
  { text: "Best place for manicure and pedicure in {city}", topic: "beauty_services", strength: 83 },
  { text: "Beauty salon for women in South {city}", topic: "beauty_services", strength: 80 },
  { text: "Recommended unisex salons in {city}", topic: "beauty_services", strength: 78 },
  { text: "Best beauty studio for party makeover in {city}", topic: "beauty_services", strength: 84 },
  // Skincare (8)
  { text: "Best skincare clinic near me", topic: "skincare", strength: 72 },
  { text: "Where to get a HydraFacial in {city}?", topic: "skincare", strength: 80 },
  { text: "Best clinic for acne scar treatment in {city}", topic: "skincare", strength: 74 },
  { text: "Chemical peel treatment in {city} reviews", topic: "skincare", strength: 76 },
  { text: "Top skin care centres in {city}", topic: "skincare", strength: 78 },
  { text: "Best place for facials in {city}", topic: "skincare", strength: 79 },
  { text: "Pigmentation treatment clinic in {city}", topic: "skincare", strength: 70 },
  { text: "Dermatologist-recommended facial studio in {city}", topic: "skincare", strength: 38 },
  // Makeup (10)
  { text: "Top makeup artists in {city}", topic: "makeup", strength: 41 },
  { text: "Best bridal makeup artist in {city}", topic: "makeup", strength: 78 },
  { text: "HD makeup services in {city}", topic: "makeup", strength: 74 },
  { text: "Airbrush makeup for weddings in {city}", topic: "makeup", strength: 72 },
  { text: "Engagement makeup artist in {city}", topic: "makeup", strength: 76 },
  { text: "Makeup studio for photoshoots in {city}", topic: "makeup", strength: 70 },
  { text: "Best party makeup near me", topic: "makeup", strength: 73 },
  { text: "Affordable bridal makeup packages in {city}", topic: "makeup", strength: 75 },
  { text: "Makeup artist who travels to venue in {city}", topic: "makeup", strength: 68 },
  { text: "Makeup classes in {city}", topic: "makeup", strength: 36 },
  // Hair services (7)
  { text: "Best hair salon in {city}", topic: "hair_services", strength: 76 },
  { text: "Keratin treatment salon in {city}", topic: "hair_services", strength: 74 },
  { text: "Best place for hair colour and balayage in {city}", topic: "hair_services", strength: 72 },
  { text: "Hair spa near me", topic: "hair_services", strength: 70 },
  { text: "Bridal hairstyling in {city}", topic: "hair_services", strength: 78 },
  { text: "Hair smoothening salons in {city}", topic: "hair_services", strength: 71 },
  { text: "Men's grooming salon in {city}", topic: "hair_services", strength: 34 },
  // Local beauty professionals (5)
  { text: "Beauty professionals near Connaught Place", topic: "local_professionals", strength: 80 },
  { text: "Home beauty services in {city}", topic: "local_professionals", strength: 74 },
  { text: "Certified beauticians in {city}", topic: "local_professionals", strength: 77 },
  { text: "Best reviewed beauty experts near me", topic: "local_professionals", strength: 79 },
  { text: "Independent beauty professionals in {city}", topic: "local_professionals", strength: 76 },
];

const FREQUENCIES: PromptFrequency[] = ["daily", "weekly", "weekly", "monthly"];

/** Topic phrase used in simulated answers. */
const TOPIC_PHRASE: Record<TopicId, string> = {
  beauty_services: "beauty services",
  skincare: "skincare treatments",
  makeup: "makeup",
  hair_services: "hair services",
  local_professionals: "local beauty professionals",
};

/** Fictional businesses that appear alongside the profile in AI answers. */
const ANSWER_BUSINESSES: { name: string; blurb: Record<TopicId, string> }[] = [
  {
    name: "Lumière Beauty Lounge",
    blurb: {
      beauty_services: "Known for full-service bridal and party packages with an experienced senior team.",
      skincare: "Offers facials and peels alongside its salon services.",
      makeup: "Frequently booked for bridal and engagement looks.",
      hair_services: "Popular for colour work and keratin treatments.",
      local_professionals: "A large team of certified stylists and beauticians.",
    },
  },
  {
    name: "Aura Skin & Wellness",
    blurb: {
      beauty_services: "Combines beauty treatments with wellness therapies.",
      skincare: "Focuses on clinical facials, HydraFacial and pigmentation care.",
      makeup: "Provides HD makeup for events on appointment.",
      hair_services: "Offers hair spa and scalp treatments.",
      local_professionals: "Staffed by trained aestheticians.",
    },
  },
  {
    name: "The Glam Room",
    blurb: {
      beauty_services: "A contemporary studio that reviewers mention for friendly service.",
      skincare: "Offers basic facials and clean-up treatments.",
      makeup: "Known for airbrush and editorial makeup.",
      hair_services: "Offers styling and blow-dry services.",
      local_professionals: "Offers at-home appointments in several neighbourhoods.",
    },
  },
  {
    name: "Velvet Touch Salon",
    blurb: {
      beauty_services: "A long-running neighbourhood salon with moderate pricing.",
      skincare: "Offers facials and waxing services.",
      makeup: "Offers party and engagement makeup.",
      hair_services: "Frequently mentioned for haircuts and colour.",
      local_professionals: "A small team of experienced beauticians.",
    },
  },
  {
    name: "Saffron Beauty Bar",
    blurb: {
      beauty_services: "Offers express services and walk-in appointments.",
      skincare: "Offers organic facial options.",
      makeup: "Offers makeup lessons and event makeup.",
      hair_services: "Offers hair treatments and styling.",
      local_professionals: "Offers home visits for groups.",
    },
  },
];

const OWN_BLURB: Record<TopicId, string> = {
  beauty_services: "Offers bridal, party and everyday beauty services, and is often noted for hygiene standards and punctual appointments.",
  skincare: "Offers facials, HydraFacial and chemical peels performed by trained skin therapists.",
  makeup: "Provides HD and airbrush bridal makeup with trial sessions available.",
  hair_services: "Offers keratin, smoothening, colour and bridal hairstyling.",
  local_professionals: "A team of certified beauty professionals with consistently positive customer reviews.",
};

/** Builds a realistic list-style answer. `position` is where the profile appears (null = not mentioned). */
function composeResponse(
  prompt: string,
  topic: TopicId,
  city: string,
  businessName: string,
  position: number | null,
  seed: number,
): { text: string; competitorsMentioned: string[] } {
  const random = rng(seed);
  const pool = [...ANSWER_BUSINESSES].sort(() => random() - 0.5);
  const listLength = 4 + Math.floor(random() * 2);
  const entries: { name: string; blurb: string }[] = pool
    .slice(0, position ? listLength - 1 : listLength)
    .map((b) => ({ name: b.name, blurb: b.blurb[topic] }));
  if (position) entries.splice(Math.min(position, entries.length + 1) - 1, 0, { name: businessName, blurb: OWN_BLURB[topic] });

  const where = prompt.toLowerCase().includes("near me") ? `near you in ${city}` : `in ${city}`;
  const intro = `Here are some well-reviewed options for ${TOPIC_PHRASE[topic]} ${where}, based on publicly available reviews and business information:`;
  const list = entries.map((e, i) => `${i + 1}. ${e.name} — ${e.blurb}`).join("\n");
  const outro =
    "Availability and pricing can change, so it's a good idea to check recent reviews and confirm details directly with each business before booking.";

  return {
    text: `${intro}\n\n${list}\n\n${outro}`,
    competitorsMentioned: entries.filter((e) => e.name !== businessName).map((e) => e.name),
  };
}

/** Simulated result for one prompt on one platform. Exported for re-runs and new prompts. */
export function demoPromptResult(
  input: { promptId: string; prompt: string; topic: TopicId; platform: AiPlatform; strength: number; run: number },
  profile: AiVisibilityProfile,
): Pick<PromptCheck, "mentioned" | "position" | "visibility" | "previousVisibility" | "response"> {
  const seed = seedFrom(profile.id, input.promptId, input.platform, input.run);
  const visibility = Math.max(18, Math.min(97, input.strength + PLATFORM_OFFSET[input.platform] + pickInt(seed, -6, 6)));
  const previousVisibility = Math.max(10, visibility - pickInt(seed + 1, -3, 9));
  const mentioned = visibility >= 50;
  const position = mentioned ? (visibility >= 84 ? pickInt(seed + 2, 1, 2) : visibility >= 74 ? pickInt(seed + 2, 2, 3) : pickInt(seed + 2, 3, 5)) : null;
  const prompt = input.prompt;
  const { text, competitorsMentioned } = composeResponse(prompt, input.topic, profile.city, profile.businessName, position, seed + 3);
  return { mentioned, position, visibility, previousVisibility, response: { text, competitorsMentioned, isSample: true } };
}

/** The four example rows from the product brief keep their exact values on the primary profile. */
const PINNED: Record<string, { platform: AiPlatform; visibility: number; position: number | null; daysAgo: number }> = {
  "Best beauty professionals in {city}": { platform: "chatgpt", visibility: 86, position: 2, daysAgo: 0 },
  "Best skincare clinic near me": { platform: "gemini", visibility: 72, position: 4, daysAgo: 1 },
  "Top makeup artists in {city}": { platform: "perplexity", visibility: 41, position: null, daysAgo: 1 },
  "Best beauty services in {city}": { platform: "claude", visibility: 79, position: 3, daysAgo: 2 },
};

function demoPrompts(profile: AiVisibilityProfile, now: Date): { prompts: TrackedPrompt[]; checks: PromptCheck[] } {
  const prompts: TrackedPrompt[] = [];
  const checks: PromptCheck[] = [];
  const primary = profile.id === DEMO_AI_VISIBILITY_PROFILES[0]!.id;

  PROMPT_LIBRARY.forEach((seedPrompt, index) => {
    const id = `${profile.id}_p${index + 1}`;
    const text = seedPrompt.text.replace("{city}", profile.city).replace("Connaught Place", profile.city === "Delhi" ? "Connaught Place" : "Cyber City");
    const strength = primary ? seedPrompt.strength : Math.max(20, seedPrompt.strength - pickInt(seedFrom(id), 2, 9));
    prompts.push({
      id,
      prompt: text,
      topic: seedPrompt.topic,
      frequency: FREQUENCIES[index % FREQUENCIES.length]!,
      platforms: PLATFORMS,
      strength,
      createdAt: subDays(now, 60 + index).toISOString(),
    });

    const pinned = primary ? PINNED[seedPrompt.text] : undefined;
    PLATFORMS.forEach((platform) => {
      const result = demoPromptResult({ promptId: id, prompt: text, topic: seedPrompt.topic, platform, strength, run: 0 }, profile);
      let daysAgo = pickInt(seedFrom(id, platform, "checked"), 0, 3);
      if (pinned?.platform === platform) {
        result.visibility = pinned.visibility;
        result.position = pinned.position;
        result.mentioned = pinned.position !== null;
        const composed = composeResponse(text, seedPrompt.topic, profile.city, profile.businessName, pinned.position, seedFrom(id, platform, "pinned"));
        result.response = { text: composed.text, competitorsMentioned: composed.competitorsMentioned, isSample: true };
        daysAgo = pinned.daysAgo;
      }
      checks.push({
        id: `${id}_${platform}`,
        promptId: id,
        platform,
        status: "tracked",
        checkedAt: subHours(startOfDay(subDays(now, daysAgo)), -pickInt(seedFrom(id, platform), 7, 18)).toISOString(),
        runCount: 1,
        ...result,
      });
    });
  });

  return { prompts, checks };
}

/* -------------------------------------------------------------------------- */
/* History                                                                    */
/* -------------------------------------------------------------------------- */

/** Overall score by days-ago: ~58 six months ago, 69 thirty days ago, 78 today. */
function overallBaseline(daysAgo: number, target: number): number {
  if (daysAgo <= 29) return target - (9 * daysAgo) / 29;
  return target - 9 - (11 * Math.min(daysAgo - 29, 151)) / 151;
}

/** 180 days of daily visibility and mentions per platform, ending today. */
function demoHistory(profile: AiVisibilityProfile, now: Date, target: number): VisibilityHistoryPoint[] {
  const points: VisibilityHistoryPoint[] = [];
  for (let daysAgo = 179; daysAgo >= 0; daysAgo -= 1) {
    const date = startOfDay(subDays(now, daysAgo));
    const base = overallBaseline(daysAgo, target);
    const anchored = daysAgo === 0 || daysAgo === 29;
    const platforms = {} as VisibilityHistoryPoint["platforms"];
    PLATFORMS.forEach((platform) => {
      const seed = seedFrom(profile.id, platform, daysAgo);
      const noise = anchored ? 0 : (rng(seed)() - 0.5) * 5;
      const random = rng(seed + 7)();
      platforms[platform] = {
        visibility: Math.round(Math.max(0, Math.min(100, base + PLATFORM_OFFSET[platform] + noise))),
        mentions: Math.max(0, Math.round(PLATFORM_MENTION_RATE[platform] - daysAgo / 600 + (random - 0.5) * 1.2)),
      };
    });
    points.push({ date: date.toISOString(), platforms });
  }
  return points;
}

/* -------------------------------------------------------------------------- */
/* Competitors                                                                */
/* -------------------------------------------------------------------------- */

function demoCompetitors(profile: AiVisibilityProfile): AiVisibilityCompetitor[] {
  const shift = profile.id === DEMO_AI_VISIBILITY_PROFILES[0]!.id ? 0 : -4;
  return [
    { id: `${profile.id}_c1`, name: "Lumière Beauty Lounge", website: "lumierebeautylounge.example", location: profile.city, visibility: 72 + shift, previousVisibility: 70 + shift, mentions: 109, selected: true },
    { id: `${profile.id}_c2`, name: "Aura Skin & Wellness", website: "auraskinwellness.example", location: profile.city, visibility: 65 + shift, previousVisibility: 66 + shift, mentions: 94, selected: true },
    { id: `${profile.id}_c3`, name: "The Glam Room", website: "theglamroom.example", location: profile.city, visibility: 58 + shift, previousVisibility: 55 + shift, mentions: 81, selected: true },
    { id: `${profile.id}_c4`, name: "Velvet Touch Salon", website: "velvettouchsalon.example", location: profile.city, visibility: 52 + shift, previousVisibility: 54 + shift, mentions: 63, selected: false },
  ];
}

/** Estimated visibility for a competitor added from the UI. */
export function demoNewCompetitorMetrics(name: string): Pick<AiVisibilityCompetitor, "visibility" | "previousVisibility" | "mentions"> {
  const seed = seedFrom("competitor", name.toLowerCase());
  const visibility = pickInt(seed, 38, 74);
  return { visibility, previousVisibility: visibility - pickInt(seed + 1, -4, 6), mentions: pickInt(seed + 2, 30, 110) };
}

/* -------------------------------------------------------------------------- */
/* Dataset                                                                    */
/* -------------------------------------------------------------------------- */

export function demoAiVisibilityDataset(profile: AiVisibilityProfile, now = new Date()): AiVisibilityDataset {
  const target = profile.id === DEMO_AI_VISIBILITY_PROFILES[0]!.id ? 78 : 71;
  const { prompts, checks } = demoPrompts(profile, now);
  return {
    profileId: profile.id,
    prompts,
    checks,
    history: demoHistory(profile, now, target),
    competitors: demoCompetitors(profile),
  };
}
