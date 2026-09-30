import { Lock } from "lucide-react";
import { MobileField, MobileListRow } from "@/components/layout/shared/data-table";
import { cn } from "@/lib/utils";
import { ReportStatusBadge } from "../white-label-ui";
import { ModulesSummary, ReportActions } from "./report-actions";
import { lastUpdated, type ReportRow, type ReportRowHandlers } from "./report-row";

/** Mobile: one structured card per report instead of a cramped table. */
export function ClientReportCard({ row, handlers }: { row: ReportRow; handlers: ReportRowHandlers }) {
  return (
    <MobileListRow>
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="min-w-0 text-left" onClick={() => handlers.onView(row)}>
          <span className="block truncate text-sm font-medium text-foreground">{row.client.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {row.client.category} · {row.client.city}
          </span>
        </button>
        <ReportStatusBadge status={row.report.status} />
      </div>
      <p className={cn("mt-2 flex min-w-0 items-center gap-1.5 font-mono text-xs", row.report.status === "disabled" ? "text-muted-foreground line-through" : "text-foreground")}>
        {row.report.visibility === "password" ? <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Password protected" /> : null}
        <span className="truncate">{row.url}</span>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MobileField label="Business" value={<ModulesSummary report={row.report} />} />
        <MobileField label="Last updated" value={lastUpdated(row)} />
      </div>
      <div className="-mx-2 mt-2 border-t border-border pt-1">
        <ReportActions row={row} handlers={handlers} compact />
      </div>
    </MobileListRow>
  );
}
