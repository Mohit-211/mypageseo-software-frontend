import { BookOpenCheck, Building2, FileText, ListChecks, MessageSquareHeart, Swords, TrendingUp, type LucideIcon } from "lucide-react";

/** One icon per report type, the same as the module it reports on. */
export const REPORT_TYPE_ICON: Record<string, LucideIcon> = {
  rank_tracker: TrendingUp,
  gbp_audit: Building2,
  competitor_analysis: Swords,
  citation: ListChecks,
  reputation: MessageSquareHeart,
  full: BookOpenCheck,
  gbp_report: Building2,
  review_insights: MessageSquareHeart,
};

export function reportTypeIcon(type: string): LucideIcon {
  return REPORT_TYPE_ICON[type] ?? FileText;
}
