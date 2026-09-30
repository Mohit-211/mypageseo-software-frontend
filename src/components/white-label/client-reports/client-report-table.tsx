import { Lock } from "lucide-react";
import { TableBody, TableHead, TableRow, TableScroll, Th, tdClass, tdMutedClass } from "@/components/layout/shared/data-table";
import { cn } from "@/lib/utils";
import { ReportStatusBadge } from "../white-label-ui";
import { ModulesSummary, ReportActions } from "./report-actions";
import { lastUpdated, type ReportRow, type ReportRowHandlers } from "./report-row";

/** Tablet and desktop: full table, horizontally scrollable when narrow. */
export function ClientReportTable({ rows, handlers }: { rows: ReportRow[]; handlers: ReportRowHandlers }) {
  return (
    <TableScroll minWidth={980} label="Client reports">
      <TableHead>
        <Th>Client</Th>
        <Th>Business</Th>
        <Th>Report Status</Th>
        <Th>Report URL</Th>
        <Th>Last Updated</Th>
        <Th align="right">Actions</Th>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.report.id}>
            <td className={`${tdClass} max-w-56`}>
              <button
                type="button"
                className="block max-w-full truncate text-left font-medium text-foreground hover:text-primary hover:underline"
                onClick={() => handlers.onView(row)}
              >
                {row.client.name}
              </button>
              <p className="truncate text-xs text-muted-foreground">
                {row.client.category} · {row.client.city}
              </p>
            </td>
            <td className={`${tdClass} max-w-52`}>
              <ModulesSummary report={row.report} />
            </td>
            <td className={tdClass}>
              <ReportStatusBadge status={row.report.status} />
            </td>
            <td className={`${tdClass} max-w-72`}>
              <span className={cn("flex min-w-0 items-center gap-1.5 font-mono text-xs", row.report.status === "disabled" ? "text-muted-foreground line-through" : "text-foreground")}>
                {row.report.visibility === "password" ? <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Password protected" /> : null}
                <span className="truncate" title={row.url}>
                  {row.url}
                </span>
              </span>
            </td>
            <td className={`${tdMutedClass} whitespace-nowrap`}>{lastUpdated(row)}</td>
            <td className={`${tdClass} text-right`}>
              <ReportActions row={row} handlers={handlers} />
            </td>
          </TableRow>
        ))}
      </TableBody>
    </TableScroll>
  );
}
