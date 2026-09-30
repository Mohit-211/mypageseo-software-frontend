import { Copy, ExternalLink, Lock } from "lucide-react";
import { FormAlert } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { withScheme } from "@/lib/white-label/white-label";
import { copyText } from "../white-label-theme";
import { ReportStatusBadge } from "../white-label-ui";
import type { ReportRow } from "./report-row";

export function ShareReportModal({
  row,
  onClose,
  onOpenReport,
}: {
  row: ReportRow | null;
  onClose: () => void;
  onOpenReport: (row: ReportRow) => void;
}) {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Report</DialogTitle>
          <DialogDescription>Send this link to your client. It opens the report in your agency branding.</DialogDescription>
        </DialogHeader>
        {row ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Client</p>
                <p className="truncate text-sm font-medium text-foreground">{row.client.name}</p>
              </div>
              <ReportStatusBadge status={row.report.status} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Report URL</p>
              <div className="mt-1.5 flex items-center gap-2 rounded-md border border-border bg-background py-1 pl-3 pr-1">
                <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground" title={row.url}>
                  {row.url}
                </code>
                <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="Copy report link" onClick={() => void copyText(withScheme(row.url), "Report link copied.")}>
                  <Copy aria-hidden />
                </Button>
              </div>
            </div>
            {row.report.visibility === "password" ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" aria-hidden /> Password protected — share the password with your client separately.
              </p>
            ) : null}
            {row.report.status === "draft" ? <FormAlert tone="info">This report is a draft. Publish it before your client opens the link.</FormAlert> : null}
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => row && void copyText(withScheme(row.url), "Report link copied.")}>
            <Copy aria-hidden /> Copy Link
          </Button>
          <Button type="button" onClick={() => row && onOpenReport(row)}>
            <ExternalLink aria-hidden /> Open Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
