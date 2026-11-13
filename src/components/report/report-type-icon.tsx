import { createElement } from "react";
import { reportTypeIcon } from "@/lib/reports/report-icons";

/** The icon of a report type (the module it reports on). Decorative: the label next to it says what it is. */
export function ReportTypeIcon({ type, className }: { type: string; className?: string }) {
  return createElement(reportTypeIcon(type), { className, "aria-hidden": true });
}
