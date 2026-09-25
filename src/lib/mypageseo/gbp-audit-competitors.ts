import { withDemoFallback } from "./demo/demo-mode";
import { demoGbpAuditCompetitors } from "./demo/gbp";

export type GbpAuditCompetitorStatus = "loading" | "ready" | "partial" | "disconnected" | "no_competitors" | "no_data" | "error";
export type GbpAuditCompetitorSort = "name" | "local_pack_position" | "reviews" | "rating" | "citations" | "photos" | "authority";
export type GbpAuditCompetitorOrder = "asc" | "desc";

export type ComparableMetric = {
  value: number | string | null;
  previousValue: number | string | null;
};

export type GbpAuditCompetitorEntity = {
  id: string;
  name: string;
  isSelectedLocation: boolean;
  localPackPosition: ComparableMetric;
  citations: ComparableMetric;
  keyCitations: ComparableMetric;
  links: ComparableMetric;
  linkingDomains: ComparableMetric;
  websiteAuthority: ComparableMetric;
  reviewCount: ComparableMetric;
  starRating: ComparableMetric;
  photos: ComparableMetric;
  primaryCategory: string | null;
};

export type GbpAuditCompetitiveFinding = {
  id: string;
  title: string;
  observation: string;
  metric: string;
  locationValue: number | string;
  competitorName: string;
  competitorValue: number | string;
};

export type GbpAuditRankingComparison = {
  id: string;
  keyword: string;
  businessName: string;
  currentPosition: number | null;
  previousPosition: number | null;
  movement: number | null;
  resultType: string | null;
};

export type GbpAuditCompetitorsData = {
  status: GbpAuditCompetitorStatus;
  analyzedAt: string | null;
  searchContext: { keyword: string | null; area: string | null; resultType: string | null } | null;
  contexts: Array<{ id: string; label: string }>;
  selectedContextId: string | null;
  entities: GbpAuditCompetitorEntity[];
  findings: GbpAuditCompetitiveFinding[];
  rankingComparison: GbpAuditRankingComparison[];
};

/**
 * The live GBP competitor-audit feed is not connected in this frontend yet,
 * so this adapter falls back to a deterministic demo competitive comparison.
 */
export function getGbpAuditCompetitors(
  locationId?: string | null,
  real?: GbpAuditCompetitorsData | null,
): GbpAuditCompetitorsData {
  return withDemoFallback(real, () => demoGbpAuditCompetitors(locationId));
}
