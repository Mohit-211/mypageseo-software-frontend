/** Demo dataset for the Automations screen. */
import { demoDate, demoDateAhead } from "./demo-mode";
import { DEMO_CLIENTS, demoLocation } from "./entities";
import type { Automation, AutomationRun, AutomationRunStatus, AutomationType } from "../automations";

function clientName(clientId: string): string {
  return DEMO_CLIENTS.find((c) => c.id === clientId)?.name ?? clientId;
}

type Seed = {
  id: string;
  name: string;
  type: AutomationType;
  locationId: string;
  frequency: string;
  status: Automation["status"];
  lastRunDaysAgo: number | null;
  lastRunStatus: AutomationRunStatus | null;
  lastRunSummary: string | null;
  nextRunInDays: number | null;
  failureReason: string | null;
};

const SEEDS: Seed[] = [
  {
    id: "auto_riverside_north_rank_alert",
    name: "Riverside North — Ranking drop alert",
    type: "rank_change_alert",
    locationId: "loc_riverside_north",
    frequency: "Daily",
    status: "active",
    lastRunDaysAgo: 1,
    lastRunStatus: "success",
    lastRunSummary: "No significant drops detected across 24 keywords.",
    nextRunInDays: 1,
    failureReason: null,
  },
  {
    id: "auto_riverside_north_posts",
    name: "Riverside North — Weekly GBP post",
    type: "gbp_post_scheduler",
    locationId: "loc_riverside_north",
    frequency: "Weekly · Tuesdays",
    status: "active",
    lastRunDaysAgo: 2,
    lastRunStatus: "success",
    lastRunSummary: "Whitening offer post published.",
    nextRunInDays: 5,
    failureReason: null,
  },
  {
    id: "auto_riverside_south_review_alert",
    name: "Riverside South — New review alert",
    type: "review_alert",
    locationId: "loc_riverside_south",
    frequency: "Real-time",
    status: "active",
    lastRunDaysAgo: 0,
    lastRunStatus: "success",
    lastRunSummary: "2 new reviews notified to the team.",
    nextRunInDays: null,
    failureReason: null,
  },
  {
    id: "auto_riverside_south_report",
    name: "Riverside South — Monthly performance report",
    type: "report_delivery",
    locationId: "loc_riverside_south",
    frequency: "Monthly · 1st",
    status: "active",
    lastRunDaysAgo: 11,
    lastRunStatus: "success",
    lastRunSummary: "Report emailed to 3 recipients.",
    nextRunInDays: 19,
    failureReason: null,
  },
  {
    id: "auto_riverside_round_rock_citation",
    name: "Riverside Round Rock — Citation monitor",
    type: "citation_monitor",
    locationId: "loc_riverside_round_rock",
    frequency: "Weekly",
    status: "paused",
    lastRunDaysAgo: 9,
    lastRunStatus: "partial",
    lastRunSummary: "3 NAP inconsistencies found, 12 directories unreachable.",
    nextRunInDays: null,
    failureReason: null,
  },
  {
    id: "auto_riverside_round_rock_review",
    name: "Riverside Round Rock — Unanswered review reminder",
    type: "review_alert",
    locationId: "loc_riverside_round_rock",
    frequency: "Daily",
    status: "running",
    lastRunDaysAgo: 0,
    lastRunStatus: "running",
    lastRunSummary: "Checking reviews posted in the last 24 hours…",
    nextRunInDays: 1,
    failureReason: null,
  },
  {
    id: "auto_hearth_downtown_posts",
    name: "Hearth Downtown — GBP post scheduler",
    type: "gbp_post_scheduler",
    locationId: "loc_hearth_downtown",
    frequency: "Weekly · Thursdays",
    status: "active",
    lastRunDaysAgo: 3,
    lastRunStatus: "success",
    lastRunSummary: "Weekly promotion post published.",
    nextRunInDays: 4,
    failureReason: null,
  },
  {
    id: "auto_hearth_cherry_rank_alert",
    name: "Hearth Cherry Creek — Ranking drop alert",
    type: "rank_change_alert",
    locationId: "loc_hearth_cherry",
    frequency: "Daily",
    status: "failed",
    lastRunDaysAgo: 2,
    lastRunStatus: "failed",
    lastRunSummary: null,
    nextRunInDays: 1,
    failureReason: "Ranking data for 2 keywords could not be refreshed.",
  },
  {
    id: "auto_hearth_cherry_citation",
    name: "Hearth Cherry Creek — Citation monitor",
    type: "citation_monitor",
    locationId: "loc_hearth_cherry",
    frequency: "Weekly",
    status: "active",
    lastRunDaysAgo: 5,
    lastRunStatus: "success",
    lastRunSummary: "All 41 tracked directories consistent.",
    nextRunInDays: 2,
    failureReason: null,
  },
  {
    id: "auto_summit_main_report_delivery",
    name: "Summit Auto Care — Monthly report delivery",
    type: "report_delivery",
    locationId: "loc_summit_main",
    frequency: "Monthly · 1st",
    status: "active",
    lastRunDaysAgo: 6,
    lastRunStatus: "success",
    lastRunSummary: "Rank Tracker report emailed to 2 recipients.",
    nextRunInDays: 24,
    failureReason: null,
  },
  {
    id: "auto_summit_main_review_alert",
    name: "Summit Auto Care — New review alert",
    type: "review_alert",
    locationId: "loc_summit_main",
    frequency: "Real-time",
    status: "active",
    lastRunDaysAgo: 1,
    lastRunStatus: "success",
    lastRunSummary: "1 new review notified to the team.",
    nextRunInDays: null,
    failureReason: null,
  },
  {
    id: "auto_lumen_main_citation",
    name: "Lumen Family Law — Citation monitor",
    type: "citation_monitor",
    locationId: "loc_lumen_main",
    frequency: "Weekly",
    status: "active",
    lastRunDaysAgo: 4,
    lastRunStatus: "partial",
    lastRunSummary: "1 new inconsistency flagged.",
    nextRunInDays: 3,
    failureReason: null,
  },
  {
    id: "auto_lumen_main_rank_alert",
    name: "Lumen Family Law — Ranking change alert",
    type: "rank_change_alert",
    locationId: "loc_lumen_main",
    frequency: "Weekly",
    status: "paused",
    lastRunDaysAgo: 16,
    lastRunStatus: "success",
    lastRunSummary: "4 keywords improved, 1 declined.",
    nextRunInDays: null,
    failureReason: null,
  },
  {
    id: "auto_lumen_main_report",
    name: "Lumen Family Law — Client report delivery",
    type: "report_delivery",
    locationId: "loc_lumen_main",
    frequency: "Monthly · 5th",
    status: "failed",
    lastRunDaysAgo: 7,
    lastRunStatus: "failed",
    lastRunSummary: null,
    nextRunInDays: 23,
    failureReason: "Report delivery bounced for one recipient address.",
  },
];

/** Deterministic short execution history derived from the seed. */
function runsFor(seed: Seed): AutomationRun[] {
  if (seed.lastRunDaysAgo === null || seed.lastRunStatus === null) return [];
  const cadenceDays = seed.frequency.startsWith("Monthly") ? 30 : seed.frequency.startsWith("Weekly") ? 7 : 1;
  const history: AutomationRun[] = [
    {
      id: `${seed.id}_run_1`,
      startedAt: demoDate(seed.lastRunDaysAgo),
      status: seed.lastRunStatus,
      summary: seed.lastRunSummary ?? seed.failureReason,
    },
  ];
  for (let i = 1; i < 3; i += 1) {
    history.push({
      id: `${seed.id}_run_${i + 1}`,
      startedAt: demoDate(seed.lastRunDaysAgo + cadenceDays * i),
      status: "success",
      summary: "Completed without issues.",
    });
  }
  return history;
}

export function demoAutomations(): Automation[] {
  return SEEDS.map((seed) => {
    const location = demoLocation(seed.locationId);
    return {
      id: seed.id,
      name: seed.name,
      type: seed.type,
      clientId: location.clientId,
      clientName: clientName(location.clientId),
      locationId: location.id,
      locationName: `${location.businessName} — ${location.area}`,
      frequency: seed.frequency,
      status: seed.status,
      lastRunAt: seed.lastRunDaysAgo === null ? null : demoDate(seed.lastRunDaysAgo),
      lastRunStatus: seed.lastRunStatus,
      lastRunSummary: seed.lastRunSummary,
      nextRunAt: seed.nextRunInDays === null ? null : demoDateAhead(seed.nextRunInDays),
      failureReason: seed.failureReason,
      recentRuns: runsFor(seed),
    };
  });
}
