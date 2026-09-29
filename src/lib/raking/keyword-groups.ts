import { withDemoFallback } from "../mypageseo/demo/demo-mode";
import { demoKeywordGroups } from "../mypageseo/demo/rankings";

export type KeywordGroupStatus = "loading" | "ready" | "no_groups" | "error";
export type GroupMovement = "improved" | "declined" | "unchanged" | "unavailable";

export type KeywordGroupRow = {
  id: string;
  name: string;
  keywordCount: number;
  averagePosition: number | null;
  localPackCoverage: number | null;
  movement: number | null;
  movementStatus: GroupMovement;
  updatedAt: string | null;
};

export type KeywordGroupsData = {
  status: KeywordGroupStatus;
  rows: KeywordGroupRow[];
  total: number;
};

/**
 * Keyword-group persistence is not connected in this frontend yet, so this
 * adapter falls back to demo groups derived from the tracked keyword set. A
 * genuine "no groups" state is still returned untouched once a real source
 * exists.
 */
export function getKeywordGroups(
  locationId?: string | null,
  real?: KeywordGroupsData | null,
): KeywordGroupsData {
  return withDemoFallback(real, () => demoKeywordGroups(locationId));
}
