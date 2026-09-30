
import { Ban, Copy, Eye, Send, Share2, Undo2 } from "lucide-react";
import { RowActions } from "@/components/layout/shared/data-table";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { REPORT_MODULE_LABEL, type ClientReport } from "@/lib/white-label/white-label";
import type { ReportRow, ReportRowHandlers } from "./report-row";

/** Primary module plus a count, e.g. "Google Business Profile +2". */
export function ModulesSummary({ report }: { report: ClientReport }) {
  const [first, ...rest] = report.modules;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={report.modules.map((m) => REPORT_MODULE_LABEL[m]).join(", ")}>
      <span className="truncate">{first ? REPORT_MODULE_LABEL[first] : "—"}</span>
      {rest.length ? <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground">+{rest.length}</span> : null}
    </span>
  );
}

/** View | Copy | Share inline, with status changes in the overflow menu. */
export function ReportActions({ row, handlers, compact }: { row: ReportRow; handlers: ReportRowHandlers; compact?: boolean }) {
  const disabled = row.report.status === "disabled";
  const name = row.client.name;
  const inline = [
    { label: "View", title: "View report", icon: Eye, onClick: handlers.onView, disabled: false },
    { label: "Copy", title: "Copy link", icon: Copy, onClick: handlers.onCopy, disabled },
    { label: "Share", title: "Share report", icon: Share2, onClick: handlers.onShare, disabled },
  ];
  return (
    <div className="flex items-center justify-end gap-0.5">
      {/* Icon-only below 2xl so the table fits beside the sidebar; the label is kept for screen readers. */}
      {inline.map(({ label, title, icon: Icon, onClick, disabled: off }) => (
        <Button
          key={label}
          type="button"
          size={compact ? "icon" : "sm"}
          variant="ghost"
          className={compact ? "size-10" : "h-8 px-2"}
          title={title}
          disabled={off}
          onClick={() => onClick(row)}
          aria-label={`${title} for ${name}`}
        >
          <Icon aria-hidden />
          {compact ? null : <span className="hidden 2xl:inline">{label}</span>}
        </Button>
      ))}
      <RowActions label={`More actions for ${name}`}>
        <DropdownMenuItem onSelect={() => handlers.onView(row)}>
          <Eye aria-hidden /> View Report
        </DropdownMenuItem>
        <DropdownMenuItem disabled={disabled} onSelect={() => handlers.onCopy(row)}>
          <Copy aria-hidden /> Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem disabled={disabled} onSelect={() => handlers.onShare(row)}>
          <Share2 aria-hidden /> Share Report
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {row.report.status === "draft" ? (
          <DropdownMenuItem onSelect={() => handlers.onPublish(row)}>
            <Send aria-hidden /> Publish Report
          </DropdownMenuItem>
        ) : null}
        {disabled ? (
          <DropdownMenuItem onSelect={() => handlers.onEnable(row)}>
            <Undo2 aria-hidden /> Enable Report
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="text-critical focus:text-critical" onSelect={() => handlers.onDisable(row)}>
            <Ban aria-hidden /> Disable Report
          </DropdownMenuItem>
        )}
      </RowActions>
    </div>
  );
}
