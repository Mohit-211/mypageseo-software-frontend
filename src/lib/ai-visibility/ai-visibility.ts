import { useSyncExternalStore } from "react";
import { differenceInCalendarDays, endOfDay, format, startOfDay, subDays, subMonths } from "date-fns";
import type { StatusTone } from "@/components/layout/shared/data-display";
import { seedFrom, pickInt } from "../mypageseo/demo/demo-mode";
import {
  DEMO_AI_VISIBILITY_PROFILES,
  demoAiVisibilityDataset,
  demoNewCompetitorMetrics,
  demoPromptResult,
} from "../mypageseo/demo/ai-visibility";

/* -------------------------------------------------------------------------- */
/* Contract                                                                   */
/*                                                                            */
/* Shapes the AI Visibility backend is expected to return. Components only    */
/* read these types, so connecting real provider data means replacing the     */
/* store's loaders/actions below — not the components.                        */
/* -------------------------------------------------------------------------- */

export type AiPlatform = "chatgpt" | "gemini" | "perplexity" | "claude";

export type TopicId = "beauty_services" | "skincare" | "makeup" | "hair_services" | "local_professionals";

export type PromptFrequency = "daily" | "weekly" | "monthly";

export type PromptCheckStatus = "tracked" | "checking";

export type AiVisibilityProfile = {
  id: string;
  businessName: string;
  city: string;
};

export type TrackedPrompt = {
  id: string;
  prompt: string;
  topic: TopicId;
  frequency: PromptFrequency;
  platforms: AiPlatform[];
  /** Demo-only seed for simulated results; a real backend does not need it. */
  strength: number;
  createdAt: string;
};

export type AiResponse = {
  text: string;
  competitorsMentioned: string[];
  /** True while responses are simulated rather than collected from a provider. */
  isSample: boolean;
};

/** The latest result of asking one prompt on one AI platform. */
export type PromptCheck = {
  id: string;
  promptId: string;
  platform: AiPlatform;
  status: PromptCheckStatus;
  /** Null until the first check completes. */
  checkedAt: string | null;
  mentioned: boolean | null;
  /** 1-based position of the business in the answer, null when not mentioned. */
  position: number | null;
  visibility: number | null;
  previousVisibility: number | null;
  response: AiResponse | null;
  runCount: number;
};

export type VisibilityHistoryPoint = {
  /** ISO date (start of day). */
  date: string;
  platforms: Record<AiPlatform, { visibility: number; mentions: number }>;
};

export type AiVisibilityCompetitor = {
  id: string;
  name: string;
  website: string;
  location: string;
  visibility: number;
  previousVisibility: number;
  mentions: number;
  /** Included in the comparison chart/table. */
  selected: boolean;
};

export type AiVisibilityDataset = {
  profileId: string;
  prompts: TrackedPrompt[];
  checks: PromptCheck[];
  history: VisibilityHistoryPoint[];
  competitors: AiVisibilityCompetitor[];
};

/* -------------------------------------------------------------------------- */
/* Labels                                                                     */
/* -------------------------------------------------------------------------- */

export const AI_PLATFORMS: AiPlatform[] = ["chatgpt", "gemini", "perplexity", "claude"];

export const AI_PLATFORM_LABEL: Record<AiPlatform, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
  claude: "Claude",
};

/** Series colour per platform. Colour follows the platform, never its rank. */
export const AI_PLATFORM_COLOR: Record<AiPlatform, string> = {
  chatgpt: "var(--chart-1)",
  gemini: "var(--chart-2)",
  perplexity: "var(--chart-4)",
  claude: "var(--chart-3)",
};

export const TOPICS: TopicId[] = ["beauty_services", "skincare", "makeup", "hair_services", "local_professionals"];

export const TOPIC_LABEL: Record<TopicId, string> = {
  beauty_services: "Beauty Services",
  skincare: "Skincare",
  makeup: "Makeup",
  hair_services: "Hair Services",
  local_professionals: "Local Beauty Professionals",
};

export const FREQUENCY_LABEL: Record<PromptFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export const CHECK_STATUS_LABEL: Record<PromptCheckStatus, string> = {
  tracked: "Tracked",
  checking: "Checking",
};

export const CHECK_STATUS_TONE: Record<PromptCheckStatus, StatusTone> = {
  tracked: "success",
  checking: "info",
};

/* -------------------------------------------------------------------------- */
/* Date ranges                                                                */
/* -------------------------------------------------------------------------- */

export type DateRangePreset = "7d" | "30d" | "3m" | "6m" | "custom";

export type DateRangeValue = { preset: DateRangePreset; from?: string; to?: string };

export const DATE_RANGE_LABEL: Record<DateRangePreset, string> = {
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "3m": "Last 3 Months",
  "6m": "Last 6 Months",
  custom: "Custom Range",
};

export type DateBounds = { from: Date; to: Date };

export function rangeBounds(range: DateRangeValue, now = new Date()): DateBounds {
  const to = endOfDay(now);
  switch (range.preset) {
    case "7d":
      return { from: startOfDay(subDays(now, 6)), to };
    case "30d":
      return { from: startOfDay(subDays(now, 29)), to };
    case "3m":
      return { from: startOfDay(subMonths(now, 3)), to };
    case "6m":
      return { from: startOfDay(subMonths(now, 6)), to };
    case "custom":
      return {
        from: startOfDay(range.from ? new Date(range.from) : subDays(now, 29)),
        to: endOfDay(range.to ? new Date(range.to) : now),
      };
  }
}

export function describeRange(range: DateRangeValue): string {
  if (range.preset !== "custom" || !range.from || !range.to) return DATE_RANGE_LABEL[range.preset];
  return `${format(new Date(range.from), "MMM d")} – ${format(new Date(range.to), "MMM d, yyyy")}`;
}

/* -------------------------------------------------------------------------- */
/* Derived metrics                                                            */
/*                                                                            */
/* Every number shown on the dashboard is computed from tracked results here, */
/* so the UI never states a figure the data does not support.                 */
/* -------------------------------------------------------------------------- */

export type PlatformFilter = AiPlatform | "all";

export type TrendPoint = { date: string; visibility: number; mentions: number };

function pointValue(point: VisibilityHistoryPoint, filter: PlatformFilter): TrendPoint {
  const platforms = filter === "all" ? AI_PLATFORMS : [filter];
  const visibility = platforms.reduce((sum, p) => sum + point.platforms[p].visibility, 0) / platforms.length;
  const mentions = platforms.reduce((sum, p) => sum + point.platforms[p].mentions, 0);
  return { date: point.date, visibility: Math.round(visibility * 10) / 10, mentions };
}

function inBounds(history: VisibilityHistoryPoint[], bounds: DateBounds) {
  return history.filter((p) => {
    const d = new Date(p.date);
    return d >= bounds.from && d <= bounds.to;
  });
}

/** Same-length period immediately before `bounds`. */
function previousBounds(bounds: DateBounds): DateBounds {
  const days = differenceInCalendarDays(bounds.to, bounds.from) + 1;
  return { from: startOfDay(subDays(bounds.from, days)), to: endOfDay(subDays(bounds.from, 1)) };
}

export function trendSeries(history: VisibilityHistoryPoint[], bounds: DateBounds, filter: PlatformFilter): TrendPoint[] {
  return inBounds(history, bounds).map((p) => pointValue(p, filter));
}

/** "+5", "−3", "0" with an optional suffix. */
export function formatSigned(value: number, suffix = "") {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)}${suffix}`;
}

/** Relative % change, null when there is no baseline to compare against. */
export function percentChange(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export type PlatformStat = {
  platform: AiPlatform;
  visibility: number;
  mentions: number;
  change: number | null;
  prompts: number;
};

export type VisibilitySummary = {
  score: number;
  startScore: number | null;
  scoreChange: number | null;
  mentions: number;
  mentionsDelta: number | null;
  promptsTracked: number;
  platformsTracked: number;
  competitorGap: number | null;
  platforms: PlatformStat[];
};

export function summarize(dataset: AiVisibilityDataset, bounds: DateBounds): VisibilitySummary | null {
  const current = inBounds(dataset.history, bounds);
  const latest = current.at(-1);
  if (!latest) return null;
  const prevPoints = inBounds(dataset.history, previousBounds(bounds));
  // Baseline is the last day before the period, so "change" compares like with like.
  const baseline = prevPoints.at(-1) ?? null;

  const score = Math.round(pointValue(latest, "all").visibility);
  const baselineScore = baseline ? pointValue(baseline, "all").visibility : null;
  const mentions = current.reduce((sum, p) => sum + pointValue(p, "all").mentions, 0);
  const prevMentions = prevPoints.length === current.length ? prevPoints.reduce((sum, p) => sum + pointValue(p, "all").mentions, 0) : null;

  const compared = dataset.competitors.filter((c) => c.selected);
  const competitorAverage = compared.length ? compared.reduce((sum, c) => sum + c.visibility, 0) / compared.length : null;

  const platformsInUse = AI_PLATFORMS.filter((platform) => dataset.prompts.some((p) => p.platforms.includes(platform)));

  return {
    score,
    startScore: Math.round(pointValue(current[0]!, "all").visibility),
    scoreChange: percentChange(score, baselineScore),
    mentions,
    mentionsDelta: prevMentions === null ? null : mentions - prevMentions,
    promptsTracked: dataset.prompts.length,
    platformsTracked: platformsInUse.length,
    competitorGap: competitorAverage === null ? null : Math.round(score - competitorAverage),
    platforms: AI_PLATFORMS.map((platform) => ({
      platform,
      visibility: latest.platforms[platform].visibility,
      mentions: current.reduce((sum, p) => sum + p.platforms[platform].mentions, 0),
      change: percentChange(latest.platforms[platform].visibility, baseline?.platforms[platform].visibility),
      prompts: dataset.prompts.filter((p) => p.platforms.includes(platform)).length,
    })),
  };
}

export type TopicStat = {
  topic: TopicId;
  prompts: number;
  visibility: number | null;
  mentions: number;
  change: number | null;
};

function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function topicStats(dataset: AiVisibilityDataset): TopicStat[] {
  return TOPICS.map((topic) => {
    const promptIds = new Set(dataset.prompts.filter((p) => p.topic === topic).map((p) => p.id));
    const checks = dataset.checks.filter((c) => promptIds.has(c.promptId) && c.visibility !== null);
    const visibility = average(checks.map((c) => c.visibility!));
    const previous = average(checks.filter((c) => c.previousVisibility !== null).map((c) => c.previousVisibility!));
    return {
      topic,
      prompts: promptIds.size,
      visibility: visibility === null ? null : Math.round(visibility),
      mentions: checks.filter((c) => c.mentioned).length,
      change: visibility === null ? null : percentChange(visibility, previous),
    };
  }).filter((t) => t.prompts > 0);
}

/** Neutral, factual observations derived from tracked results. No recommendations. */
export function visibilityInsights(dataset: AiVisibilityDataset, summary: VisibilitySummary | null): string[] {
  const insights: string[] = [];
  const checked = dataset.checks.filter((c) => c.mentioned !== null);
  if (checked.length) {
    const mentioned = checked.filter((c) => c.mentioned).length;
    insights.push(`Your business was mentioned in ${mentioned} of ${checked.length} tracked responses.`);
  }
  if (summary?.scoreChange !== null && summary?.scoreChange !== undefined) {
    const verb = summary.scoreChange > 0 ? "increased" : summary.scoreChange < 0 ? "decreased" : "did not change";
    insights.push(
      summary.scoreChange === 0
        ? "Visibility did not change compared with the previous period."
        : `Visibility ${verb} by ${Math.abs(summary.scoreChange)}% compared with the previous period.`,
    );
  }
  const topTopic = [...topicStats(dataset)].sort((a, b) => b.mentions - a.mentions)[0];
  if (topTopic && topTopic.mentions > 0) {
    insights.push(`${TOPIC_LABEL[topTopic.topic]} prompts generated ${topTopic.mentions} mentions — the most of any topic.`);
  }
  const notMentioned = dataset.prompts.filter((p) => {
    const checks = dataset.checks.filter((c) => c.promptId === p.id && c.mentioned !== null);
    return checks.length > 0 && checks.every((c) => !c.mentioned);
  }).length;
  if (checked.length) {
    insights.push(
      notMentioned === 1
        ? "1 tracked prompt did not mention your business on any platform during the latest check."
        : `${notMentioned} tracked prompts did not mention your business on any platform during the latest check.`,
    );
  }
  if (summary) {
    const [first, second] = [...summary.platforms].sort((a, b) => b.mentions - a.mentions);
    if (first && second) {
      insights.push(`${AI_PLATFORM_LABEL[first.platform]} produced ${first.mentions} mentions in this period, compared with ${second.mentions} on ${AI_PLATFORM_LABEL[second.platform]}.`);
    }
  }
  return insights;
}

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/*                                                                            */
/* No AI provider is connected yet, so results live in a frontend-only store  */
/* seeded with demo data. Replace the bodies of the actions with backend      */
/* mutations when available; components only use the hook and actions.       */
/* -------------------------------------------------------------------------- */

type AiVisibilityState = {
  profiles: AiVisibilityProfile[];
  activeProfileId: string;
  datasets: Record<string, AiVisibilityDataset>;
  analysisRunning: boolean;
};

let state: AiVisibilityState = {
  profiles: DEMO_AI_VISIBILITY_PROFILES,
  activeProfileId: DEMO_AI_VISIBILITY_PROFILES[0]!.id,
  datasets: {},
  analysisRunning: false,
};

const listeners = new Set<() => void>();
const pendingLoads = new Set<string>();

function setState(update: (current: AiVisibilityState) => AiVisibilityState) {
  state = update(state);
  listeners.forEach((listener) => listener());
}

/** Simulates fetching a profile's dataset so loading states are exercised. */
function ensureLoaded(profileId: string) {
  if (state.datasets[profileId] || pendingLoads.has(profileId)) return;
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile) return;
  pendingLoads.add(profileId);
  window.setTimeout(() => {
    pendingLoads.delete(profileId);
    setState((s) => ({ ...s, datasets: { ...s.datasets, [profileId]: demoAiVisibilityDataset(profile) } }));
  }, 700);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureLoaded(state.activeProfileId);
  return () => listeners.delete(listener);
}

export function useAiVisibilityStore() {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  const profile = snapshot.profiles.find((p) => p.id === snapshot.activeProfileId) ?? null;
  const dataset = snapshot.datasets[snapshot.activeProfileId] ?? null;
  return {
    status: dataset ? ("ready" as const) : ("loading" as const),
    profiles: snapshot.profiles,
    profile,
    dataset,
    analysisRunning: snapshot.analysisRunning,
  };
}

function updateDataset(update: (dataset: AiVisibilityDataset) => AiVisibilityDataset) {
  const id = state.activeProfileId;
  const dataset = state.datasets[id];
  if (!dataset) return;
  setState((s) => ({ ...s, datasets: { ...s.datasets, [id]: update(dataset) } }));
}

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const CHECK_DURATION_MS = 1600;

/** Marks checks as running, then resolves them with a fresh simulated result. */
function runChecks(match: (check: PromptCheck) => boolean): Promise<number> {
  const profileId = state.activeProfileId;
  const profile = state.profiles.find((p) => p.id === profileId);
  let count = 0;
  updateDataset((d) => ({
    ...d,
    checks: d.checks.map((c) => {
      if (!match(c)) return c;
      count += 1;
      return { ...c, status: "checking" };
    }),
  }));
  return new Promise((resolve) => {
    window.setTimeout(() => {
      const dataset = state.datasets[profileId];
      if (!dataset || !profile) return resolve(count);
      const now = new Date().toISOString();
      const checks = dataset.checks.map((c) => {
        if (c.status !== "checking" || !match(c)) return c;
        const prompt = dataset.prompts.find((p) => p.id === c.promptId);
        if (!prompt) return c;
        const run = c.runCount + 1;
        const result = demoPromptResult(
          { promptId: prompt.id, prompt: prompt.prompt, topic: prompt.topic, platform: c.platform, strength: prompt.strength, run },
          profile,
        );
        return { ...c, ...result, previousVisibility: c.visibility ?? result.previousVisibility, status: "tracked" as const, checkedAt: now, runCount: run };
      });
      setState((s) => ({ ...s, datasets: { ...s.datasets, [profileId]: { ...dataset, checks } } }));
      resolve(count);
    }, CHECK_DURATION_MS);
  });
}

function pendingCheck(promptId: string, platform: AiPlatform): PromptCheck {
  return {
    id: `${promptId}_${platform}`,
    promptId,
    platform,
    status: "checking",
    checkedAt: null,
    mentioned: null,
    position: null,
    visibility: null,
    previousVisibility: null,
    response: null,
    runCount: 0,
  };
}

export type PromptInput = { prompt: string; topic: TopicId; platforms: AiPlatform[]; frequency: PromptFrequency };

export type CompetitorInput = { name: string; website: string; location: string };

export const aiVisibilityActions = {
  setProfile(profileId: string) {
    setState((s) => ({ ...s, activeProfileId: profileId }));
    ensureLoaded(profileId);
  },

  /** Re-checks every tracked prompt on every platform. */
  async runAnalysis(): Promise<number> {
    setState((s) => ({ ...s, analysisRunning: true }));
    try {
      return await runChecks(() => true);
    } finally {
      setState((s) => ({ ...s, analysisRunning: false }));
    }
  },

  rerunPrompt(promptId: string, platform?: AiPlatform): Promise<number> {
    return runChecks((c) => c.promptId === promptId && (!platform || c.platform === platform));
  },

  addPrompt(input: PromptInput): TrackedPrompt {
    const id = newId("prompt");
    const prompt: TrackedPrompt = {
      id,
      ...input,
      strength: pickInt(seedFrom(input.prompt.toLowerCase()), 42, 86),
      createdAt: new Date().toISOString(),
    };
    updateDataset((d) => ({
      ...d,
      prompts: [prompt, ...d.prompts],
      checks: [...input.platforms.map((p) => pendingCheck(id, p)), ...d.checks],
    }));
    void runChecks((c) => c.promptId === id);
    return prompt;
  },

  updatePrompt(promptId: string, input: PromptInput) {
    const existing = state.datasets[state.activeProfileId]?.prompts.find((p) => p.id === promptId);
    if (!existing) return;
    const textChanged = existing.prompt.trim() !== input.prompt.trim();
    updateDataset((d) => {
      const kept = d.checks.filter((c) => c.promptId !== promptId || input.platforms.includes(c.platform));
      const added = input.platforms
        .filter((p) => !d.checks.some((c) => c.promptId === promptId && c.platform === p))
        .map((p) => pendingCheck(promptId, p));
      return {
        ...d,
        prompts: d.prompts.map((p) => (p.id === promptId ? { ...p, ...input } : p)),
        checks: [...kept, ...added],
      };
    });
    // A new question needs fresh answers; otherwise only newly added platforms run.
    void runChecks((c) => c.promptId === promptId && (textChanged || c.status === "checking"));
  },

  deletePrompt(promptId: string) {
    updateDataset((d) => ({
      ...d,
      prompts: d.prompts.filter((p) => p.id !== promptId),
      checks: d.checks.filter((c) => c.promptId !== promptId),
    }));
  },

  addCompetitor(input: CompetitorInput): AiVisibilityCompetitor {
    const competitor: AiVisibilityCompetitor = {
      id: newId("competitor"),
      ...input,
      ...demoNewCompetitorMetrics(input.name),
      selected: true,
    };
    updateDataset((d) => ({ ...d, competitors: [...d.competitors, competitor] }));
    return competitor;
  },

  removeCompetitor(competitorId: string) {
    updateDataset((d) => ({ ...d, competitors: d.competitors.filter((c) => c.id !== competitorId) }));
  },

  setCompetitorSelected(competitorId: string, selected: boolean) {
    updateDataset((d) => ({
      ...d,
      competitors: d.competitors.map((c) => (c.id === competitorId ? { ...c, selected } : c)),
    }));
  },
};
