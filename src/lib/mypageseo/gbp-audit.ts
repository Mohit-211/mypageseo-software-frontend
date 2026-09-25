import { withDemoFallback } from "./demo/demo-mode";
import { demoGbpAudit } from "./demo/gbp";

export type GbpAuditStatus = "loading" | "ready" | "partial" | "disconnected" | "not_generated" | "error";
export type AuditFindingStatus = "healthy" | "attention" | "warning" | "incomplete" | "unavailable";

export type AuditFinding = {
  id: string;
  title: string;
  status: AuditFindingStatus;
  summary: string;
  whyItMatters: string | null;
  nextStep: string | null;
};

export type AuditCategory = {
  id: string;
  title: string;
  description: string;
  status: AuditFindingStatus;
  findings: AuditFinding[];
};

export type GbpAuditData = {
  status: GbpAuditStatus;
  checkedAt: string | null;
  score: number | null;
  scoreLabel: string | null;
  scoreExplanation: string | null;
  summary: { passed: number | null; attention: number | null; unavailable: number | null };
  categories: AuditCategory[];
  previousAudit: { checkedAt: string; score: number | null } | null;
  canRunAudit: boolean;
};

/**
 * The live location-level GBP audit source is not connected in this frontend
 * yet, so this adapter falls back to a deterministic demo audit.
 */
export function getGbpAudit(
  locationId?: string | null,
  real?: GbpAuditData | null,
): GbpAuditData {
  return withDemoFallback(real, () => demoGbpAudit(locationId));
}
