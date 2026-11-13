/**
 * Data and saving for a location's tracked keywords.
 *
 * - `useKeywordRows` joins the saved list (`GET tracking`, in the saved order) with the latest
 *   ranking run, the keyword groups and Google's search terms, one row per keyword. The list renders
 *   from `tracking` alone; rank columns fill in when the run answers, and a run error never blocks it.
 * - `useSaveKeywords` saves a whole new list (`PUT tracking` replaces it): adding checks the run
 *   estimate first, so a list that a run would refuse (`over_cap`) is never saved.
 *
 * The tracking query key is the one `useTracking` (rankings) and the global search use, so a save
 * shows up everywhere at once.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getTrackingEstimate,
  isApiError,
  updateTracking,
  type KeywordGroup,
  type RankSummary,
  type RankTrackerResponse,
  type SearchKeywordsSection,
  type TrackingResponse,
} from "@/api";
import { noteAccountError } from "@/lib/billing/account-restriction";
import { gbpReportQuery } from "@/lib/gbp/use-gbp-report";
import { LOCATIONS_QUERY_KEY } from "@/lib/locations/use-locations";
import { rankingErrorState, rankingsKey, useKeywordGroups, useRankTracker, useTracking } from "@/lib/rankings/use-rankings";
import { byText, sortRows } from "@/lib/sort";
import { bandFor, type KeywordBand } from "./bands";
import { addKeywords, keywordKey, MAX_KEYWORDS } from "./keywords";
import { usageFor, type KeywordUse } from "./usage-rules";

export { useKeywordGroups, useKeywordHistory, useTracking } from "@/lib/rankings/use-rankings";

/** `GET tracking` (shared with the rankings pages, the post editor and the global search). */
export const trackingKey = (locationId: string) => [...rankingsKey(locationId), "tracking"] as const;

/** One search term people typed before finding the profile (GBP report, latest month). */
export type SearchTerm = SearchKeywordsSection["top"][number];

export type TrackerKeyword = RankTrackerResponse["keywords"][number];

export type KeywordRow = {
  /** The tracked spelling. */
  text: string;
  /** The comparison form (`keywordKey`). */
  key: string;
  /** 0-based place in the saved list: the AI priority. */
  position: number;
  /** The latest ranking run measured it (false: added after that run). */
  measured: boolean;
  /** The business's numbers for it in the latest run. */
  self: RankSummary | null;
  band: KeywordBand;
  /** Groups it belongs to, A–Z. */
  groups: KeywordGroup[];
  /** Google searches for it last month, when it is one of the profile's top search terms. */
  searches: SearchTerm | null;
  use: KeywordUse;
  /** The latest run's entry: every tracked business at the 5 spots (detail sheet). */
  entry: TrackerKeyword | null;
};

/** What the latest-run part of the page can show. */
export type TrackerState = "loading" | "ready" | "no_run" | "error";

export function useKeywordRows(locationId: string, options: { gbpConnected: boolean }) {
  const tracking = useTracking(locationId);
  // The latest run for every keyword (no group filter): the same query the location loader prefetches.
  const tracker = useRankTracker(locationId, undefined);
  const groups = useKeywordGroups(locationId);
  const report = useQuery({ ...gbpReportQuery(locationId, "28d"), enabled: options.gbpConnected });

  const saved = tracking.data?.tracking.keywords ?? [];
  // `useRankTracker` keeps the previous answer while a new one loads (handy between runs and groups);
  // here that could be another location's run, so a placeholder counts as still loading.
  const run = tracker.isPlaceholderData ? undefined : tracker.data;
  const byKey = new Map<string, TrackerKeyword>();
  for (const entry of run?.keywords ?? []) byKey.set(keywordKey(entry.keyword), entry);

  const groupList = sortRows(groups.data?.groups ?? [], byText((group) => group.name));
  // Google can list one search twice (different case or spacing): keep its first, biggest entry.
  const termByKey = new Map<string, SearchTerm>();
  const section = report.data?.keywords.available ? report.data.keywords : null;
  for (const term of section?.top ?? []) {
    const key = keywordKey(term.keyword);
    if (!termByKey.has(key)) termByKey.set(key, term);
  }
  const terms: SearchKeywordsSection | null = section ? { ...section, top: [...termByKey.values()] } : null;

  const rows: KeywordRow[] = saved.map((keyword, position) => {
    const key = keywordKey(keyword.text);
    const entry = byKey.get(key) ?? null;
    const self = entry?.summary.self ?? null;
    const measured = entry !== null;
    return {
      text: keyword.text,
      key,
      position,
      measured,
      self,
      band: bandFor(self, measured),
      groups: groupList.filter((group) => group.keywords.some((name) => keywordKey(name) === key)),
      searches: termByKey.get(key) ?? null,
      use: usageFor(position),
      entry,
    };
  });

  const trackerState: TrackerState = tracker.isPending || tracker.isPlaceholderData
    ? "loading"
    : tracker.isError
      ? rankingErrorState(tracker.error).kind === "no_completed_run"
        ? "no_run"
        : "error"
      : "ready";

  return {
    rows,
    tracking,
    tracker,
    trackerState,
    run: run ?? null,
    groups,
    groupList,
    groupLimit: groups.data?.limit ?? 20,
    report,
    /** The profile's top search terms (latest month), when the GBP report has them. */
    searchTerms: terms,
    max: MAX_KEYWORDS,
  };
}

/** A save refused before it was sent: the grid can't measure that many keywords in one run. */
export class KeywordsOverCapError extends Error {
  readonly count: number;
  readonly gridSize: number | null;
  constructor(count: number, gridSize: number | null) {
    super("over_cap");
    this.name = "KeywordsOverCapError";
    this.count = count;
    this.gridSize = gridSize;
  }
}

export type KeywordErrorText = {
  message: string;
  /** Offer a link to billing (402 `subscription_required`). */
  billing?: boolean;
};

/** Words for a failed keyword save. */
export function keywordErrorText(err: unknown): KeywordErrorText {
  if (err instanceof KeywordsOverCapError) {
    const grid = err.gridSize ? `your ${err.gridSize}×${err.gridSize} grid` : "your grid";
    return {
      message: `With ${grid}, ${err.count} keywords need more searches than one ranking run may make. Choose a smaller grid in Grid settings on the Rankings pages, or track fewer keywords.`,
    };
  }
  if (!isApiError(err)) return { message: "The keywords couldn't be saved. Try again." };
  switch (err.reason) {
    case "read_only":
      return { message: "Your access is read-only. Ask the team that manages this account to change keywords." };
    case "subscription_required":
      return { message: "Your account is read-only until you subscribe, so keywords can't be changed right now.", billing: true };
    case "organization_suspended":
      return { message: "This account is suspended. Contact support to restore access." };
    default:
      break;
  }
  if (err.status === 400 && err.message && !/server/i.test(err.message)) return { message: err.message };
  if (err.status === 0) return { message: "You seem to be offline. Check your connection and try again." };
  return { message: "The keywords couldn't be saved. Try again." };
}

/**
 * Saves the whole keyword list (adds, removals and the order all go through here). Free; it needs
 * an active subscription or trial (402) and edit rights (403 for a client user).
 */
export function useSaveKeywords(locationId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (next: string[]): Promise<TrackingResponse> => {
      const current = queryClient.getQueryData<TrackingResponse>(trackingKey(locationId))?.tracking.keywords.length ?? 0;
      if (next.length > current) {
        // A run with more keywords than the grid allows is refused at run time (422), so check first.
        // If the estimate itself fails, the save goes ahead: the backend stays the judge.
        const estimate = await getTrackingEstimate(locationId, { keywords: next.length }).catch(() => null);
        if (estimate?.over_cap) throw new KeywordsOverCapError(next.length, estimate.grid.size ?? null);
      }
      return updateTracking(locationId, { keywords: next });
    },
    onSuccess: (response) => {
      queryClient.setQueryData(trackingKey(locationId), response);
      // Groups lose removed keywords, summaries and the dashboard recount; the list itself is fresh already.
      void queryClient.invalidateQueries({ queryKey: rankingsKey(locationId), predicate: (query) => query.queryKey[3] !== "tracking" });
      void queryClient.invalidateQueries({ queryKey: [...LOCATIONS_QUERY_KEY, "overview", locationId] });
      void queryClient.invalidateQueries({ queryKey: ["organization", "usage"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => noteAccountError(err),
  });
  return { save: mutation.mutateAsync, saving: mutation.isPending };
}

/**
 * One-click "Track" for a keyword outside the Keywords page (a Google search term on GBP Overview):
 * adds it with the Keywords page's rules (limit, duplicates, the run estimate) and says so in a toast.
 * A save replaces the whole list, so the list is read from the cache at click time and nothing is
 * saved before it has loaded.
 */
export function useTrackKeyword(locationId: string) {
  const queryClient = useQueryClient();
  const { save, saving } = useSaveKeywords(locationId);

  const track = async (keyword: string): Promise<void> => {
    const current = queryClient.getQueryData<TrackingResponse>(trackingKey(locationId))?.tracking.keywords.map((entry) => entry.text);
    if (!current) {
      toast.error("The keyword couldn't be added", { description: "Your keywords haven't loaded yet. Try again in a moment." });
      return;
    }
    const result = addKeywords(current, keyword);
    if (result.added.length === 0) {
      toast.info(result.message ?? `“${keyword}” is already tracked.`);
      return;
    }
    try {
      await save(result.keywords);
      toast.success(`“${result.added[0] ?? keyword}” is now tracked`, {
        description: "It's measured from the next ranking run. Manage your keywords on the Keywords page.",
      });
    } catch (err) {
      toast.error("The keyword couldn't be added", { description: keywordErrorText(err).message });
    }
  };

  return { track, saving };
}
